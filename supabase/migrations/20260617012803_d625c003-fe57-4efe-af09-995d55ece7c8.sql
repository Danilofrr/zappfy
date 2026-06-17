
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS checkout_secure_label TEXT DEFAULT 'Checkout seguro',
  ADD COLUMN IF NOT EXISTS checkout_step1_button_label TEXT DEFAULT 'Continuar',
  ADD COLUMN IF NOT EXISTS checkout_step2_button_label TEXT DEFAULT 'Calcular frete',
  ADD COLUMN IF NOT EXISTS checkout_step3_button_label TEXT DEFAULT 'Ir para pagamento',
  ADD COLUMN IF NOT EXISTS checkout_step_button_color TEXT DEFAULT '#a855f7',
  ADD COLUMN IF NOT EXISTS checkout_step_button_text_color TEXT DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS shipping_options JSONB DEFAULT '[{"id":"motoboy","label":"Motoboy","price":19.9},{"id":"pac","label":"Correios PAC","price":24.9},{"id":"sedex","label":"Correios SEDEX","price":34.9}]'::jsonb,
  ADD COLUMN IF NOT EXISTS checkout_footer_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkout_footer_brand TEXT DEFAULT 'Esparta Imports',
  ADD COLUMN IF NOT EXISTS checkout_footer_copyright TEXT DEFAULT '© 2026 VILIES NEGOCIOS DIGITAIS CNPJ: 50.888.578/0001-02',
  ADD COLUMN IF NOT EXISTS checkout_footer_email TEXT DEFAULT 'suporte@espartaimports.com.br',
  ADD COLUMN IF NOT EXISTS checkout_footer_payments TEXT DEFAULT 'pix,visa,mastercard,elo,amex,hipercard';
