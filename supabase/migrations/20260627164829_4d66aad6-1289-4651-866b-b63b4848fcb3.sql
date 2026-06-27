ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS fb_account_id text,
  ADD COLUMN IF NOT EXISTS fb_ad_account_name text,
  ADD COLUMN IF NOT EXISTS fb_currency text,
  ADD COLUMN IF NOT EXISTS fb_timezone_name text,
  ADD COLUMN IF NOT EXISTS fb_connection_status text;