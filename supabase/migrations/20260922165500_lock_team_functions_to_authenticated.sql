-- Restringe as funções internas da Equipe a usuários autenticados.
REVOKE ALL ON FUNCTION public.team_can_access_store(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_has_permission(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_accessible_stores() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_store_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_store_snapshot(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_can_access_order(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_order_json(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_create_order(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_update_order(uuid,uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_update_order_status(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_delete_order(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_update_checkout_settings(uuid,jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.team_can_access_store(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_has_permission(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_accessible_stores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_store_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_store_snapshot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_can_access_order(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_order_json(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_create_order(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_update_order(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_update_order_status(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_delete_order(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_update_checkout_settings(uuid,jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
