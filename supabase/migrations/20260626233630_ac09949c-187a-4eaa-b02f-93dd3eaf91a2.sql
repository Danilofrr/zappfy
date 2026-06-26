
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS fb_access_token text,
  ADD COLUMN IF NOT EXISTS fb_ad_account_id text,
  ADD COLUMN IF NOT EXISTS fb_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS fb_last_sync_status text,
  ADD COLUMN IF NOT EXISTS fb_last_sync_error text;
