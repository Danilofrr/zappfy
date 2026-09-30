
CREATE OR REPLACE FUNCTION public.sync_after_sales_tracking_from_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP='UPDATE' THEN
    UPDATE public.delivery_tracking
    SET operation_type=CASE
          WHEN NEW.resolution_type IN ('exchange_same','exchange_other') THEN 'exchange'
          ELSE 'return'
        END,
        notes=NEW.reason,
        updated_at=now()
    WHERE return_id=NEW.id
      AND status NOT IN ('entregue','devolvido','cancelado');
    RETURN NEW;
  END IF;

  IF TG_OP='DELETE' THEN
    DELETE FROM public.delivery_tracking
    WHERE return_id=OLD.id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_after_sales_tracking_update ON public.returns;
CREATE TRIGGER trg_sync_after_sales_tracking_update
AFTER UPDATE OF resolution_type,reason,new_product_id,new_product_name,product_id,product_name,quantity
ON public.returns
FOR EACH ROW
EXECUTE FUNCTION public.sync_after_sales_tracking_from_return();

DROP TRIGGER IF EXISTS trg_cleanup_after_sales_tracking_delete ON public.returns;
CREATE TRIGGER trg_cleanup_after_sales_tracking_delete
BEFORE DELETE ON public.returns
FOR EACH ROW
EXECUTE FUNCTION public.sync_after_sales_tracking_from_return();

NOTIFY pgrst,'reload schema';
