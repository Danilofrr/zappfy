ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS delivery_label text NOT NULL DEFAULT 'Entrega',
  ADD COLUMN IF NOT EXISTS checkout_button_label text NOT NULL DEFAULT 'Enviar pedido pelo WhatsApp',
  ADD COLUMN IF NOT EXISTS checkout_button_color text NOT NULL DEFAULT '#a855f7';

UPDATE public.settings SET delivery_fee = 19.90 WHERE delivery_fee = 0;