ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS checkout_footer_cards_image_height INTEGER DEFAULT 40;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';