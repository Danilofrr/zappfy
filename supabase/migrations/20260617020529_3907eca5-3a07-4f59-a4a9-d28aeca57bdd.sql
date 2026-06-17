ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS checkout_logo_align TEXT DEFAULT 'left',
  ADD COLUMN IF NOT EXISTS checkout_step1_title TEXT DEFAULT 'Dados pessoais',
  ADD COLUMN IF NOT EXISTS checkout_step2_title TEXT DEFAULT 'Entrega',
  ADD COLUMN IF NOT EXISTS checkout_step3_title TEXT DEFAULT 'Pagamento',
  ADD COLUMN IF NOT EXISTS checkout_footer_cards_image_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS checkout_footer_show_cards_image BOOLEAN DEFAULT true;