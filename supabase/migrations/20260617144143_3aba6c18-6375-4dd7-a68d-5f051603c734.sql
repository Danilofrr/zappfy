CREATE TABLE public.notification_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX idx_notification_subscriptions_user_id ON public.notification_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_subscriptions TO authenticated;
GRANT ALL ON public.notification_subscriptions TO service_role;

ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
ON public.notification_subscriptions
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_notification_subscriptions_updated_at
BEFORE UPDATE ON public.notification_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();