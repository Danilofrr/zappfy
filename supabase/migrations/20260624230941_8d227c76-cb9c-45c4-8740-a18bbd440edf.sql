CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily retention: kiwify_webhook_logs > 90 days
SELECT cron.schedule(
  'retention-kiwify-webhook-logs',
  '0 3 * * *',
  $$ DELETE FROM public.kiwify_webhook_logs WHERE created_at < now() - INTERVAL '90 days'; $$
);

-- Daily retention: access_logs > 180 days
SELECT cron.schedule(
  'retention-access-logs',
  '15 3 * * *',
  $$ DELETE FROM public.access_logs WHERE created_at < now() - INTERVAL '180 days'; $$
);