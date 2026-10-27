-- Cada loja precisa ter um checkout exclusivo. Não altera links públicos já configurados.
-- O identificador derivado da UUID evita colisão mesmo entre lojas de mesmo nome.
CREATE OR REPLACE FUNCTION public.ensure_checkout_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF nullif(btrim(NEW.slug), '') IS NULL THEN
    NEW.slug := 'loja-' || replace(NEW.store_id::text, '-', '');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ensure_checkout_slug ON public.settings;
CREATE TRIGGER trg_ensure_checkout_slug
BEFORE INSERT OR UPDATE OF slug ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.ensure_checkout_slug();

-- Ativa os endereços que faltam nas lojas existentes.
UPDATE public.settings
SET slug = NULL
WHERE nullif(btrim(slug), '') IS NULL;

-- Dados da Esparta nunca devem ser os padrões das lojas novas.
ALTER TABLE public.settings ALTER COLUMN checkout_footer_brand SET DEFAULT '';
ALTER TABLE public.settings ALTER COLUMN checkout_footer_email SET DEFAULT '';
ALTER TABLE public.settings ALTER COLUMN checkout_footer_copyright SET DEFAULT '';

-- Remove apenas os valores antigos herdados; preserva a Esparta e dados personalizados.
UPDATE public.settings
SET
  checkout_footer_brand = CASE
    WHEN checkout_footer_brand = 'Esparta Imports' THEN ''
    ELSE checkout_footer_brand END,
  checkout_footer_email = CASE
    WHEN checkout_footer_email = 'suporte@espartaimports.com.br' THEN ''
    ELSE checkout_footer_email END
WHERE lower(store_name) NOT LIKE '%esparta%'
  AND (checkout_footer_brand = 'Esparta Imports'
    OR checkout_footer_email = 'suporte@espartaimports.com.br');

-- Checkout público exige o slug e limita produtos/configurações à loja selecionada.
CREATE OR REPLACE FUNCTION public.get_public_checkout_payload(_slug text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.settings;
  settings_json jsonb;
  products_json jsonb;
  clean_slug text := lower(trim(COALESCE(_slug, '')));
BEGIN
  -- Nunca escolher outra loja quando o checkout for aberto sem identificação.
  IF clean_slug = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO s
  FROM public.settings
  WHERE slug IS NOT NULL
    AND lower(slug) = clean_slug
  LIMIT 1;

  IF s.store_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    to_jsonb(sp)
    || jsonb_build_object(
      'checkout_logo_url',
        CASE
          WHEN sp.checkout_logo_url LIKE 'data:%'
            THEN '/api/public/store-asset/' || s.slug || '/logo'
          ELSE sp.checkout_logo_url
        END,
      'checkout_footer_cards_image_url',
        CASE
          WHEN sp.checkout_footer_cards_image_url LIKE 'data:%'
            THEN '/api/public/store-asset/' || s.slug || '/cards'
          ELSE sp.checkout_footer_cards_image_url
        END
    )
  INTO settings_json
  FROM public.settings_public sp
  WHERE lower(sp.slug) = lower(s.slug)
  LIMIT 1;

  WITH mobile AS (
    SELECT ci.product_id, COALESCE(sum(ci.quantity), 0)::integer AS qty
    FROM public.courier_inventory ci
    JOIN public.couriers c
      ON c.id = ci.courier_id
     AND c.store_id = ci.store_id
     AND c.active = true
    WHERE ci.store_id = s.store_id
      AND ci.quantity > 0
    GROUP BY ci.product_id
  ),
  reservations AS (
    SELECT
      (item->>'productId')::uuid AS product_id,
      o.id AS order_id,
      sum(
        CASE
          WHEN COALESCE(item->>'inventoryReservationVersion', '') = '2'
           AND COALESCE(item->>'mobileReservedQty', '') ~ '^\d+$'
          THEN (item->>'mobileReservedQty')::integer
          ELSE 0
        END
      )::integer AS reserved_qty
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items::jsonb, '[]'::jsonb)) item
    WHERE o.store_id = s.store_id
      AND COALESCE(o.status, '') NOT IN ('entregue', 'cancelado', 'cancelada')
      AND COALESCE(item->>'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    GROUP BY (item->>'productId')::uuid, o.id
  ),
  movement_balance AS (
    SELECT
      m.product_id,
      m.order_id,
      greatest(-COALESCE(sum(m.quantity_delta), 0), 0)::integer AS consumed_qty
    FROM public.courier_inventory_movements m
    WHERE m.store_id = s.store_id
      AND m.product_id IS NOT NULL
      AND m.order_id IS NOT NULL
      AND m.movement_type IN ('assigned', 'unassigned')
    GROUP BY m.product_id, m.order_id
  ),
  pending AS (
    SELECT
      r.product_id,
      COALESCE(sum(greatest(r.reserved_qty - COALESCE(m.consumed_qty, 0), 0)), 0)::integer AS qty
    FROM reservations r
    LEFT JOIN movement_balance m
      ON m.order_id = r.order_id
     AND m.product_id = r.product_id
    GROUP BY r.product_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'user_id', p.user_id,
        'name', p.name,
        'price', p.price,
        'stock', greatest(COALESCE(p.stock, 0) + COALESCE(m.qty, 0) - COALESCE(pd.qty, 0), 0),
        'image_url',
          CASE
            WHEN p.image_url LIKE 'data:%'
              THEN '/api/public/product-image/' || p.id::text
            ELSE p.image_url
          END,
        'created_at', p.created_at
      )
      ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO products_json
  FROM public.products p
  LEFT JOIN mobile m ON m.product_id = p.id
  LEFT JOIN pending pd ON pd.product_id = p.id
  WHERE p.store_id = s.store_id;

  RETURN jsonb_build_object(
    'settings', settings_json,
    'products', products_json
  );
END;
$function$
