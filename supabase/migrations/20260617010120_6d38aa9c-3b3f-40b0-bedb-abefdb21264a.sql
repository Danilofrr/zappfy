ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS checkout_header_bg_color text NOT NULL DEFAULT '#0a0a0a';