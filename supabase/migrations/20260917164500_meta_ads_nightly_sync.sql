-- Sincronização automática do Meta Ads.
-- O banco do Supabase está em UTC:
-- 02:59 UTC = 23:59 em America/Sao_Paulo (dia anterior)
-- 03:15 UTC = 00:15 em America/Sao_Paulo
--
-- O segundo disparo reconcilia o dia anterior, pois a Meta pode ajustar o
-- gasto alguns minutos depois do fechamento do dia.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'zappfy-meta-ads-final-2359-brt',
      'zappfy-meta-ads-reconcile-0015-brt'
    )
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END
$$;

SELECT cron.schedule(
  'zappfy-meta-ads-final-2359-brt',
  '59 2 * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://app.zappfy.shop/api/public/hooks/sync-facebook-ads',
      headers := '{"Content-Type":"application/json","X-Zappfy-Scheduler":"pg-cron-2359"}'::jsonb,
      body := '{"source":"nightly_2359_brt"}'::jsonb,
      timeout_milliseconds := 120000
    );
  $cron$
);

SELECT cron.schedule(
  'zappfy-meta-ads-reconcile-0015-brt',
  '15 3 * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://app.zappfy.shop/api/public/hooks/sync-facebook-ads',
      headers := '{"Content-Type":"application/json","X-Zappfy-Scheduler":"pg-cron-0015"}'::jsonb,
      body := '{"source":"reconcile_0015_brt"}'::jsonb,
      timeout_milliseconds := 120000
    );
  $cron$
);
