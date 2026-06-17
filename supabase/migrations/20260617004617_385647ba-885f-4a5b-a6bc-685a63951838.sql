ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS checkout_text_color text NOT NULL DEFAULT '#f8fafc',
  ADD COLUMN IF NOT EXISTS checkout_card_color text NOT NULL DEFAULT '#111111',
  ADD COLUMN IF NOT EXISTS checkout_neon_color text NOT NULL DEFAULT '#a855f7';