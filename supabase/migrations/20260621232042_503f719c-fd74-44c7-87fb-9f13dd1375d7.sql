
-- Tema padrão de rastreamento aplicado automaticamente a novos usuários
CREATE OR REPLACE FUNCTION public.apply_tracking_default_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _theme jsonb;
  _row public.delivery_tracking_settings;
BEGIN
  SELECT value INTO _theme FROM public.admin_settings WHERE key = 'tracking_default_theme' LIMIT 1;
  IF _theme IS NULL THEN
    INSERT INTO public.delivery_tracking_settings (store_id) VALUES (_user_id)
      ON CONFLICT (store_id) DO NOTHING;
    RETURN;
  END IF;

  _theme := _theme - 'id' - 'store_id' - 'created_at' - 'updated_at';
  _theme := _theme || jsonb_build_object('store_id', _user_id);

  SELECT * INTO _row FROM jsonb_populate_record(null::public.delivery_tracking_settings, _theme);
  _row.store_id := _user_id;

  INSERT INTO public.delivery_tracking_settings
  SELECT (_row).*
  ON CONFLICT (store_id) DO NOTHING;
END;
$$;

-- Atualiza o trigger de novos usuários para já criar a configuração de rastreamento padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.settings (user_id, store_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'store_name', 'Minha Loja'));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cliente')
  ON CONFLICT DO NOTHING;
  PERFORM public.apply_tracking_default_for_user(NEW.id);
  RETURN NEW;
END;
$$;
