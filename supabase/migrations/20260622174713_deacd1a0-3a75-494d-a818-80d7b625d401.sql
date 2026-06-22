ALTER TABLE public.zappfy_central_settings
  ADD COLUMN IF NOT EXISTS login_show_logo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS login_icon_size integer NOT NULL DEFAULT 64,
  ADD COLUMN IF NOT EXISTS login_glow_enabled boolean NOT NULL DEFAULT true;