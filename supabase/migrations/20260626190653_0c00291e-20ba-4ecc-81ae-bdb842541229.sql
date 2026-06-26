UPDATE public.subscriptions s
SET expires_at = (
  COALESCE(s.started_at, now()) + (
    CASE s.billing_cycle
      WHEN 'yearly' THEN INTERVAL '365 days'
      WHEN 'quarterly' THEN INTERVAL '90 days'
      ELSE INTERVAL '30 days'
    END
  )
)
WHERE s.status = 'ativo'
  AND s.billing_cycle IN ('yearly','quarterly')
  AND (
    s.expires_at IS NULL
    OR s.expires_at < COALESCE(s.started_at, now()) + (
      CASE s.billing_cycle
        WHEN 'yearly' THEN INTERVAL '300 days'
        WHEN 'quarterly' THEN INTERVAL '60 days'
        ELSE INTERVAL '20 days'
      END
    )
  );