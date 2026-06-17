ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS checkout_footer_cnpj TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS checkout_footer_show_cnpj BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkout_footer_show_email BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkout_footer_show_whatsapp BOOLEAN DEFAULT true;