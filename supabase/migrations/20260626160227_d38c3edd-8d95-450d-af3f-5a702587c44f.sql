
-- 1) Tabela stores
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Minha Loja',
  slug text UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stores_owner ON public.stores(owner_id);
CREATE UNIQUE INDEX uniq_stores_default_per_owner
  ON public.stores(owner_id) WHERE is_default = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_stores" ON public.stores
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "owner_insert_stores" ON public.stores
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_update_stores" ON public.stores
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_delete_stores" ON public.stores
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND is_default = false);

-- 2) Trigger updated_at
CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Função auxiliar p/ futuras RLS
CREATE OR REPLACE FUNCTION public.user_owns_store(_store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id AND owner_id = auth.uid()
  );
$$;

-- 4) Backfill: 1 loja padrão para cada usuário existente, reusando id = user_id
INSERT INTO public.stores (id, owner_id, name, slug, is_default)
SELECT
  s.user_id,
  s.user_id,
  COALESCE(NULLIF(trim(s.store_name), ''), 'Minha Loja'),
  s.slug,
  true
FROM public.settings s
ON CONFLICT (id) DO NOTHING;

-- Garantir que todo usuário em auth.users tenha pelo menos 1 loja
INSERT INTO public.stores (id, owner_id, name, is_default)
SELECT u.id, u.id, 'Minha Loja', true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.stores st WHERE st.owner_id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- 5) Atualizar handle_new_user para criar a loja padrão junto
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.settings (user_id, store_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'store_name', 'Minha Loja'));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cliente')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.stores (id, owner_id, name, is_default)
  VALUES (NEW.id, NEW.id, COALESCE(NEW.raw_user_meta_data->>'store_name', 'Minha Loja'), true)
  ON CONFLICT (id) DO NOTHING;
  PERFORM public.apply_tracking_default_for_user(NEW.id);
  RETURN NEW;
END;
$$;

-- 6) RPCs auxiliares para listar/criar lojas
CREATE OR REPLACE FUNCTION public.list_my_stores()
RETURNS SETOF public.stores
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.stores WHERE owner_id = auth.uid() ORDER BY is_default DESC, created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.create_my_store(_name text, _slug text DEFAULT NULL)
RETURNS public.stores
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.stores;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF COALESCE(trim(_name), '') = '' THEN RAISE EXCEPTION 'Nome da loja é obrigatório'; END IF;
  INSERT INTO public.stores (owner_id, name, slug, is_default)
  VALUES (auth.uid(), trim(_name), NULLIF(trim(COALESCE(_slug,'')),''), false)
  RETURNING * INTO s;
  RETURN s;
END;
$$;
