
-- 1. Enum de papéis
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'cliente');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('ativo','teste','pendente','vencido','bloqueado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pago','pendente','vencido','cancelado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Tabela user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. Planos
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated, anon;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans readable by all" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5. Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  status public.subscription_status NOT NULL DEFAULT 'teste',
  billing_cycle text NOT NULL DEFAULT 'mensal',
  started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz,
  expires_at timestamptz,
  last_payment_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User sees own subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 6. Pagamentos
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  method text NOT NULL DEFAULT 'manual',
  status public.payment_status NOT NULL DEFAULT 'pendente',
  due_at timestamptz,
  paid_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User sees own payments" ON public.subscription_payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage payments" ON public.subscription_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 7. Cupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 8. Activation tokens
CREATE TABLE IF NOT EXISTS public.activation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.activation_tokens TO anon, authenticated;
GRANT ALL ON public.activation_tokens TO service_role;
ALTER TABLE public.activation_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view tokens" ON public.activation_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 9. Access logs
CREATE TABLE IF NOT EXISTS public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  event text NOT NULL,
  ip text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.access_logs TO authenticated;
GRANT ALL ON public.access_logs TO service_role;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view logs" ON public.access_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 10. Admin settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage settings" ON public.admin_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 11. Updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS plans_touch ON public.plans;
CREATE TRIGGER plans_touch BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS subs_touch ON public.subscriptions;
CREATE TRIGGER subs_touch BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS pay_touch ON public.subscription_payments;
CREATE TRIGGER pay_touch BEFORE UPDATE ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS coup_touch ON public.coupons;
CREATE TRIGGER coup_touch BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 12. Seed: planos padrão
INSERT INTO public.plans (name, description, price_monthly, price_yearly, features, sort_order)
VALUES
  ('Básico','Plano inicial para começar', 49.90, 499.00, '["Pedidos ilimitados","1 loja","Suporte por e-mail"]'::jsonb, 1),
  ('Pro','Para quem vende todo dia', 97.00, 970.00, '["Tudo do Básico","Relatórios avançados","Checkout personalizado"]'::jsonb, 2),
  ('Premium','Recursos completos', 197.00, 1970.00, '["Tudo do Pro","Multi-usuários","Suporte prioritário","Automações"]'::jsonb, 3)
ON CONFLICT DO NOTHING;

-- 13. Seed: Danilo como admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('a734b965-4dc8-4ba3-87ac-d7524acbdcbe','admin')
ON CONFLICT DO NOTHING;

-- 14. Atribuir role 'cliente' aos usuários existentes não-admin
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'cliente'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role='cliente')
  AND u.id <> 'a734b965-4dc8-4ba3-87ac-d7524acbdcbe'
ON CONFLICT DO NOTHING;

-- 15. Criar assinatura ativa para clientes existentes
INSERT INTO public.subscriptions (user_id, plan_id, status, started_at, expires_at)
SELECT u.id,
       (SELECT id FROM public.plans WHERE name='Pro' LIMIT 1),
       'ativo'::public.subscription_status,
       now(),
       now() + interval '30 days'
FROM auth.users u
WHERE u.id <> 'a734b965-4dc8-4ba3-87ac-d7524acbdcbe'
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id);

-- 16. Atualizar handle_new_user para atribuir role 'cliente' automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.settings (user_id, store_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'store_name', 'Minha Loja'));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cliente')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
