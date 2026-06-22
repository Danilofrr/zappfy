## Login individual para motoboys — Central Entregas Zappfy

### 1. Banco de dados (migração)

Nova tabela `public.couriers`:
- `id uuid PK`
- `store_id uuid` (= user_id do lojista)
- `name text`
- `phone text` (WhatsApp, usado como "login" junto com o slug da loja — único por loja)
- `password_hash text` (bcrypt via `crypt()` + `gen_salt('bf')` do `pgcrypto`)
- `vehicle_type text` (moto, carro, bike, a-pé)
- `plate text` nullable
- `active boolean default true`
- `last_login_at timestamptz`
- timestamps + trigger `set_updated_at`
- `UNIQUE (store_id, phone)`

Em `delivery_tracking`: adicionar `courier_id uuid` nullable (referência lógica a `couriers.id`).

GRANTs:
- `couriers`: `SELECT/INSERT/UPDATE/DELETE` para `authenticated` (lojista gerencia via RLS); `service_role ALL`. Não dar `anon` — leitura pública vai por RPC SECURITY DEFINER.
- RLS em `couriers`: lojista (auth.uid() = store_id) gerencia seus motoboys.

RPCs SECURITY DEFINER (público, anon):
- `courier_login(_slug, _phone, _password)` → retorna `{ courier_id, courier_token (jwt simples ou random token de sessão guardado em coluna), name, phone, store_id }`. Para simplificar: gera `session_token` random e grava em nova tabela `courier_sessions(token, courier_id, expires_at)`. Retorna `session_token`. Valida `active=true`, senha via `crypt(_password, password_hash) = password_hash`.
- `courier_me(_session)` → valida sessão, retorna dados do motoboy + store_id/slug.
- `courier_logout(_session)`.
- `list_available_deliveries_v2(_session)` → entregas `aguardando_motoboy` da loja do motoboy logado (substitui versão pública por slug; mantém a antiga para compat ou remove).
- `accept_delivery_v2(_session, _code)` → identifica motoboy pela sessão, preenche `courier_id/name/phone` em `delivery_tracking`, retorna `courier_token` existente.

Nova tabela `courier_sessions`:
- `token text PK` (random 48 chars)
- `courier_id uuid`
- `expires_at timestamptz default now() + 30 days`
- `created_at`

GRANT na `courier_sessions`: apenas service_role; toda leitura via RPC.

### 2. Frontend — Cadastro de motoboys (lojista)

Nova rota `src/routes/_authenticated/motoboys.tsx`:
- Tabela com motoboys (nome, whatsapp, veículo, placa, status, último login)
- Modal de cadastro/edição: nome, WhatsApp, senha (apenas em criar/redefinir), tipo veículo, placa, ativo
- Botão ativar/desativar, redefinir senha, excluir
- Link no menu do AdminShell/AppShell ("Motoboys")

Salvar senha: enviar via RPC `create_courier(_name, _phone, _password, _vehicle, _plate, _active)` SECURITY DEFINER que aplica hash com `crypt(_password, gen_salt('bf'))` e valida `auth.uid()` = store_id.

### 3. Frontend — Login do motoboy

Nova rota pública `src/routes/entregas-zappfy.$storeSlug.login.tsx`:
- Form: WhatsApp + senha + botão Entrar
- Chama `courier_login`; em sucesso salva `session_token` em `localStorage` (chave por slug) e redireciona para `/entregas-zappfy/:slug`.
- Mensagens claras: credenciais inválidas, "Acesso desativado. Fale com a loja." quando `active=false`.

### 4. Central de Entregas — exigir login

Editar `src/routes/entregas-zappfy.$storeSlug.tsx`:
- Ao montar, ler `session_token` do localStorage. Se ausente → redirect para `/entregas-zappfy/:slug/login`.
- Chamar `courier_me(session)`; se inválida/expirada → limpar e redirect.
- Exibir nome do motoboy no header + botão "Sair".
- Listar entregas via `list_available_deliveries_v2(session)`.
- "Minhas entregas em andamento" passa a vir do servidor filtrando por `courier_id` (não mais localStorage de tokens).
- Remover modal de Aceitar (nome/WhatsApp). Botão chama `accept_delivery_v2(session, code)` direto e navega para `/entrega/:courier_token`.

### 5. Painel do lojista no pedido

No `DeliveryTrackingPanel.tsx`, quando há tracking aceito mostrar: motoboy responsável (nome), WhatsApp (link wa.me), status, horário de aceite (`updated_at` quando courier_id foi setado — gravar `accepted_at` em `delivery_tracking`), última atualização GPS (`last_updated_at`). Adicionar coluna `accepted_at` em `delivery_tracking`.

### 6. Página do cliente (`rastreio.$trackingCode.tsx`)

Sem mudanças de código — já mostra `courier_name` que agora vem do motoboy logado (nada digitado manualmente).

### 7. Segurança

- Senha sempre via `pgcrypto` (`crypt`/`gen_salt`), nunca em claro.
- Motoboy inativo → `courier_login` retorna erro específico.
- Toda leitura/escrita pública via SECURITY DEFINER validando `store_id`/sessão.
- `couriers` e `courier_sessions` sem GRANT a `anon`.

### Arquivos

**Nova migração** com: `pgcrypto` (se não ativo), `couriers`, `courier_sessions`, coluna `courier_id` + `accepted_at` em `delivery_tracking`, RLS, GRANTs, RPCs (`create_courier`, `update_courier`, `delete_courier`, `reset_courier_password`, `courier_login`, `courier_logout`, `courier_me`, `list_available_deliveries_v2`, `accept_delivery_v2`).

**Novos arquivos:**
- `src/routes/_authenticated/motoboys.tsx`
- `src/routes/entregas-zappfy.$storeSlug.login.tsx`
- `src/lib/courier-session.ts` (helpers de localStorage por slug)

**Editados:**
- `src/routes/entregas-zappfy.$storeSlug.tsx` — login obrigatório, remover modal, usar RPCs v2
- `src/components/DeliveryTrackingPanel.tsx` — exibir motoboy/horário/última atualização
- `src/components/AppShell.tsx` (ou onde fica o menu lojista) — link "Motoboys"
- `src/routeTree.gen.ts` — auto

**Não alterar:**
- `entrega.$courierToken.tsx`
- `rastreio.$trackingCode.tsx`

Confirma para eu começar pela migração?
