
CREATE OR REPLACE FUNCTION public.admin_list_clients()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  store_name text,
  whatsapp text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  roles text[],
  sub_status text,
  sub_expires_at timestamptz,
  sub_started_at timestamptz,
  plan_id uuid,
  plan_name text,
  price_monthly numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.email::text,
    COALESCE(p.full_name, '')::text AS full_name,
    COALESCE(s.store_name, '')::text AS store_name,
    COALESCE(s.whatsapp, '')::text AS whatsapp,
    u.created_at,
    u.last_sign_in_at,
    COALESCE((SELECT array_agg(r.role::text) FROM public.user_roles r WHERE r.user_id = u.id), ARRAY[]::text[]) AS roles,
    sub.status::text AS sub_status,
    sub.expires_at AS sub_expires_at,
    sub.started_at AS sub_started_at,
    sub.plan_id,
    pl.name::text AS plan_name,
    pl.price_monthly
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.settings s ON s.user_id = u.id
  LEFT JOIN public.subscriptions sub ON sub.user_id = u.id
  LEFT JOIN public.plans pl ON pl.id = sub.plan_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_clients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_clients() TO authenticated;
