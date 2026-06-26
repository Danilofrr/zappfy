# Multi-loja por cliente (ilimitado, isolamento total)

## Visão geral

Hoje cada cliente = 1 loja. O `user_id` faz papel duplo: dono da conta E identificador da loja. Vamos separar essas duas coisas: introduzir uma entidade `stores` e passar todas as tabelas operacionais a referenciar `store_id` (UUID da loja) em vez de `user_id`. O `user_id` continua sendo o dono.

Cada usuário poderá criar N lojas (ilimitado em qualquer plano). Ao entrar, ele escolhe a loja ativa; toda a dashboard, configurações, motoboys, checkout, etc. passam a operar no contexto dessa loja.

## Fases

### Fase 1 — Estrutura base e seletor (fundação)
1. **Tabela `stores`** com campos: `id`, `owner_id` (FK auth.users), `name`, `slug` (único global), `is_default`, `created_at`, `updated_at`. RLS: dono só vê/edita suas lojas.
2. **Função `current_store_id()`** (SECURITY DEFINER) lê de uma claim/setting de sessão ou cai no `is_default` do usuário — usada nas RLS.
3. **Migração de dados existentes**: para cada `user_id` atual, criar 1 linha em `stores` com `id = user_id` (mesmo UUID) e `is_default = true`. Isso preserva todos os FKs em cascata sem reescrever dados — `store_id` recebe o mesmo valor que `user_id` tem hoje.
4. **Adicionar coluna `store_id`** (igual a `user_id` por padrão) nas tabelas: `settings`, `products`, `orders`, `expenses`, `couriers`, `coupons`, `delivery_tracking`, `delivery_tracking_settings`, `purchase_orders`, `suppliers`, `returns`, `ads`, `notification_subscriptions`, `trial_invites` (apenas onde fizer sentido).
5. **Seletor de loja** no `DashboardTopBar` (dropdown ao lado do avatar): lista lojas do usuário, marca a ativa, botão "+ Nova loja". A loja ativa fica em `localStorage` + contexto React (`StoreContext`).
6. **Hook `useActiveStore()`** disponível globalmente; todas as queries passam `store_id` explicitamente.

### Fase 2 — Isolamento de produtos, pedidos, financeiro
1. Atualizar `useStore` (`src/lib/store.tsx`) para filtrar tudo por `store_id` ativo (em vez de `user_id`).
2. Atualizar todas as telas: Dashboard, Pedidos, Produtos, Despesas, Relatórios, DRE, Indicadores, Por Produto, Metas, Compras, Trocas, Ads, Precificação.
3. Atualizar RPC `submit_public_order` para resolver `store_id` via slug (já faz, só renomear conceito).
4. Realtime: atualizar canais para filtrar `store_id`.

### Fase 3 — Checkout, mensagens, motoboys, rastreamento
1. Configurações de checkout (logo, cores, mensagens WhatsApp, etiqueta, recibo) passam a viver em `settings` por `store_id`. Já são por usuário hoje — só trocar a chave.
2. Slug do checkout (`/checkout/$slug`) resolve `store_id` direto (já faz).
3. Motoboys: vinculados a `store_id`. Login do motoboy continua por slug da loja. Cada loja tem seus motoboys.
4. Rastreamento personalizado (`delivery_tracking_settings`): por loja.
5. Central de Entregas Zappfy (PWA `/entregas-zappfy/$storeSlug`) já é por slug — funciona naturalmente.

### Fase 4 — Cobrança, limites, UX polida
1. Plano é por `owner_id` (não por loja). Lojas extras = grátis dentro do plano.
2. Bloqueio de assinatura vencida afeta TODAS as lojas do dono.
3. Tela "Minhas Lojas" em Configurações: listar, renomear, definir slug, deletar (com confirmação dupla).
4. Onboarding ao criar 1ª loja extra: copia ou não as configurações da loja atual? Modal pergunta.

## Detalhes técnicos

### Banco de dados
- `stores.id` reutiliza o `user_id` na migração inicial → zero risco de quebrar FKs históricos.
- Nova loja extra gera `stores.id = gen_random_uuid()` (diferente do `owner_id`).
- RLS pattern por tabela: `USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))` — security definer function `user_owns_store(store_id)` para evitar recursão e melhorar performance.
- `settings.user_id` vira `settings.store_id` (UNIQUE). PK continua na linha; só re-mapeia semântica.
- Slug em `stores` (não mais em `settings`) com índice único.

### Frontend
- `StoreContext` provider no `AppShell`, persistência em `localStorage` (chave `zappfy.active_store_id`).
- `useActiveStore()` retorna `{ storeId, store, switchStore, createStore, stores }`.
- Refetch automático ao trocar loja (`queryClient.invalidateQueries()` + reset de filtros locais).
- Header do app exibe nome da loja ativa de forma proeminente.

### Riscos e mitigações
- **Risco**: migração de tabelas grandes pode travar. **Mitigação**: `ADD COLUMN` com default do `user_id` é instantâneo no Postgres recente; backfill em batch se necessário.
- **Risco**: queries antigas espalhadas usando `auth.uid()` direto. **Mitigação**: grep completo, substituir por `store_id` ativo, e RLS dupla (validar dono + loja).
- **Risco**: usuário trocar de loja no meio de uma ação. **Mitigação**: confirmar mudança se houver formulários abertos.
- **Risco**: `delivery_tracking` realtime fica barulhento. **Mitigação**: filtro `store_id` na subscription.

## Entregáveis por fase

```text
Fase 1: migração + StoreContext + seletor + criação de loja
Fase 2: dashboard/pedidos/produtos/financeiro filtrados por loja
Fase 3: checkout/motoboys/rastreamento por loja
Fase 4: gerenciamento de lojas + onboarding + polimento
```

## O que NÃO entra agora
- Transferência de loja entre contas
- Colaboradores por loja (funcionário com acesso só a 1 loja)
- Relatórios consolidados multi-loja (visão "todas as lojas" do dono)

Esses podem virar features futuras se você quiser.

## Próximo passo
Se aprovar este plano, começo pela **Fase 1** completa em uma única entrega (migração + UI do seletor + criação de nova loja funcional, sem ainda isolar todas as telas). Aí você testa, valida o fluxo, e seguimos para a Fase 2.