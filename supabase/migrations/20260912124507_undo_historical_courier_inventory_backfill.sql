DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      store_id,
      courier_id,
      product_id,
      COALESCE(variant_label, '') AS variant_label,
      SUM(-quantity_delta)::integer AS qty_to_restore
    FROM public.courier_inventory_movements
    WHERE movement_type = 'assigned'
      AND notes = 'Reserva automática ao atribuir pedido ao motoboy'
      AND created_at = '2026-09-12 12:26:23.401752+00'::timestamptz
      AND quantity_delta < 0
    GROUP BY store_id, courier_id, product_id, COALESCE(variant_label, '')
  LOOP
    INSERT INTO public.courier_inventory(
      store_id, courier_id, product_id, variant_label, quantity, updated_at, updated_by
    ) VALUES (
      r.store_id, r.courier_id, r.product_id, r.variant_label, r.qty_to_restore, now(), auth.uid()
    )
    ON CONFLICT (store_id, courier_id, product_id, variant_label)
    DO UPDATE SET
      quantity = public.courier_inventory.quantity + EXCLUDED.quantity,
      updated_at = now(),
      updated_by = auth.uid();
  END LOOP;

  DELETE FROM public.courier_inventory_movements
  WHERE movement_type = 'assigned'
    AND notes = 'Reserva automática ao atribuir pedido ao motoboy'
    AND created_at = '2026-09-12 12:26:23.401752+00'::timestamptz;
END $$;
