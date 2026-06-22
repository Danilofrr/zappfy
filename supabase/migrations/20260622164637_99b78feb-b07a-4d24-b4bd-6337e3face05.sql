
ALTER TABLE public.zappfy_central_settings
  ADD COLUMN IF NOT EXISTS login_logo_url text,
  ADD COLUMN IF NOT EXISTS login_icon_url text,
  ADD COLUMN IF NOT EXISTS login_bg_color text NOT NULL DEFAULT '#05070d',
  ADD COLUMN IF NOT EXISTS login_card_color text NOT NULL DEFAULT '#0b1220',
  ADD COLUMN IF NOT EXISTS login_border_color text NOT NULL DEFAULT '#1f2937',
  ADD COLUMN IF NOT EXISTS login_text_color text NOT NULL DEFAULT '#e5e7eb',
  ADD COLUMN IF NOT EXISTS login_title_color text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS login_button_color text NOT NULL DEFAULT '#10b981',
  ADD COLUMN IF NOT EXISTS login_button_text_color text NOT NULL DEFAULT '#04140b',
  ADD COLUMN IF NOT EXISTS login_glow_color text NOT NULL DEFAULT '#10b981',
  ADD COLUMN IF NOT EXISTS login_title_text text NOT NULL DEFAULT 'Entrar na sua conta',
  ADD COLUMN IF NOT EXISTS login_subtitle_text text NOT NULL DEFAULT 'Acesse a Central de Entregas',
  ADD COLUMN IF NOT EXISTS login_footer_text text NOT NULL DEFAULT 'Zappfy Entregas · © 2026';
