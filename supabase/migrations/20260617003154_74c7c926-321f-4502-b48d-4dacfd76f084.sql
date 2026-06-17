ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS checkout_logo_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS checkout_bg_color text NOT NULL DEFAULT '#0a0a0a',
  ADD COLUMN IF NOT EXISTS checkout_theme text NOT NULL DEFAULT 'dark';