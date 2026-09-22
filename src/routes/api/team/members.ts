import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient } from "@/lib/admin-client.server";

const permissionsSchema = z.array(z.enum([
  "dashboard",
  "orders",
  "tracking",
  "inventory",
  "returns",
  "couriers",
  "reports",
  "finance",
  "ads",
  "checkout",
  "integrations",
  "settings",
])).max(20);

const createSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  password: z.string().min(6).max(128),
  permissions: permissionsSchema,
});

const updateSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  name: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(6).max(128).optional(),
  permissions: permissionsSchema.optional(),
  active: z.boolean().optional(),
});

async function requireOwner(request: Request, storeId: string) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Servidor sem credenciais administrativas.");

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return { error: new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { "content-type": "application/json" } }) };

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) {
    return { error: new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { "content-type": "application/json" } }) };
  }

  const { data: store, error: storeError } = await (admin as any)
    .from("stores")
    .select("id,owner_id,name")
    .eq("id", storeId)
    .maybeSingle();

  if (storeError || !store || store.owner_id !== user.id) {
    return { error: new Response(JSON.stringify({ error: "Somente o dono da loja pode gerenciar a equipe." }), { status: 403, headers: { "content-type": "application/json" } }) };
  }

  return { admin, user, store };
}

async function findUserByEmail(admin: any, email: string) {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  for (let i = 0; i < 5; i += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((user: any) => String(user.email || "").toLowerCase() === normalized);
    if (found) return found;
    if (users.length < 200) break;
    page += 1;
  }
  return null;
}

export const Route = createFileRoute("/api/team/members")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = createSchema.parse(await request.json());
          const auth = await requireOwner(request, body.storeId);
          if ("error" in auth) return auth.error;
          const { admin, user, store } = auth as any;

          let memberUser = await findUserByEmail(admin, body.email);
          if (memberUser?.id === user.id) {
            return Response.json({ error: "O dono da loja já possui acesso total." }, { status: 400 });
          }

          if (!memberUser) {
            const created = await admin.auth.admin.createUser({
              email: body.email.trim().toLowerCase(),
              password: body.password,
              email_confirm: true,
              user_metadata: { full_name: body.name, zappfy_team_member: true },
            });
            if (created.error || !created.data.user) throw created.error || new Error("Não foi possível criar o usuário");
            memberUser = created.data.user;
          } else {
            // O usuário pode já existir no Zappfy. Não alteramos a senha automaticamente
            // para não afetar outras lojas/contas às quais ele pertença.
            await admin.auth.admin.updateUserById(memberUser.id, {
              user_metadata: { ...(memberUser.user_metadata || {}), full_name: body.name, zappfy_team_member: true },
            });
          }

          const { data, error } = await (admin as any)
            .from("team_members")
            .upsert({
              store_id: body.storeId,
              owner_id: store.owner_id,
              member_user_id: memberUser.id,
              name: body.name,
              email: body.email.trim().toLowerCase(),
              role: "employee",
              permissions: body.permissions,
              active: true,
              updated_at: new Date().toISOString(),
            }, { onConflict: "store_id,member_user_id" })
            .select("id,store_id,member_user_id,name,email,role,permissions,active,created_at,updated_at")
            .single();

          if (error) throw error;
          return Response.json({ member: data, existingUser: Boolean(await findUserByEmail(admin, body.email)) });
        } catch (error: any) {
          console.error("[team] create member failed", error);
          return Response.json({ error: error?.message || "Não foi possível criar o funcionário." }, { status: 400 });
        }
      },

      PATCH: async ({ request }) => {
        try {
          const body = updateSchema.parse(await request.json());
          const auth = await requireOwner(request, body.storeId);
          if ("error" in auth) return auth.error;
          const { admin } = auth as any;

          const { data: member, error: findError } = await (admin as any)
            .from("team_members")
            .select("id,member_user_id")
            .eq("id", body.id)
            .eq("store_id", body.storeId)
            .maybeSingle();
          if (findError || !member) return Response.json({ error: "Funcionário não encontrado." }, { status: 404 });

          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (body.name !== undefined) patch.name = body.name;
          if (body.permissions !== undefined) patch.permissions = body.permissions;
          if (body.active !== undefined) patch.active = body.active;

          const { data, error } = await (admin as any)
            .from("team_members")
            .update(patch)
            .eq("id", body.id)
            .eq("store_id", body.storeId)
            .select("id,store_id,member_user_id,name,email,role,permissions,active,created_at,updated_at")
            .single();
          if (error) throw error;

          if (body.name || body.password) {
            const userPatch: Record<string, unknown> = {};
            if (body.password) userPatch.password = body.password;
            if (body.name) {
              const { data: userData } = await admin.auth.admin.getUserById(member.member_user_id);
              userPatch.user_metadata = { ...(userData?.user?.user_metadata || {}), full_name: body.name, zappfy_team_member: true };
            }
            const updated = await admin.auth.admin.updateUserById(member.member_user_id, userPatch);
            if (updated.error) throw updated.error;
          }

          return Response.json({ member: data });
        } catch (error: any) {
          console.error("[team] update member failed", error);
          return Response.json({ error: error?.message || "Não foi possível atualizar o funcionário." }, { status: 400 });
        }
      },

      DELETE: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const storeId = z.string().uuid().parse(url.searchParams.get("storeId"));
          const id = z.string().uuid().parse(url.searchParams.get("id"));
          const auth = await requireOwner(request, storeId);
          if ("error" in auth) return auth.error;
          const { admin } = auth as any;

          const { error } = await (admin as any)
            .from("team_members")
            .delete()
            .eq("id", id)
            .eq("store_id", storeId);
          if (error) throw error;

          return Response.json({ ok: true });
        } catch (error: any) {
          console.error("[team] delete member failed", error);
          return Response.json({ error: error?.message || "Não foi possível remover o funcionário." }, { status: 400 });
        }
      },
    },
  },
});
