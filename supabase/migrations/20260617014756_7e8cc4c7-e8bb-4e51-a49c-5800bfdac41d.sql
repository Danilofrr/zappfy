ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS checkout_secure_color TEXT DEFAULT '#a855f7',
  ADD COLUMN IF NOT EXISTS checkout_logo_size INTEGER DEFAULT 40,
  ADD COLUMN IF NOT EXISTS checkout_footer_bg_color TEXT DEFAULT '#0a0a0a';