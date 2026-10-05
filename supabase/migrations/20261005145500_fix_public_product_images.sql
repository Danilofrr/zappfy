
CREATE OR REPLACE FUNCTION public.get_public_product_image(_product_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.image_url
  FROM public.products p
  JOIN public.settings s
    ON s.store_id = p.store_id
  WHERE p.id = _product_id
    AND s.slug IS NOT NULL
    AND btrim(s.slug) <> ''
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_product_image(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_product_image(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
