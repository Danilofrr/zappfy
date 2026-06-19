# Plano: Zappfy SaaS — Painel Admin Master + Área Cliente

Esse é um escopo grande. Vou dividir em fases entregáveis para você aprovar antes de cada etapa avançar. O app atual (ZappFy financeiro com pedidos, produtos, precificação, checkout) vira a **Área do Cliente**. Em cima dele criamos o **Admin Master** e o sistema de assinaturas.

---

## Fase 1 — Fundação: Roles, Planos e Assinaturas (banco + auth)

**Banco (migração Supabase):**
- `app_role` enum: `admin`, `cliente`
- `user_roles` (user_id, role) — separada do profile (segurança, evita escalonamento de privilégio)
- `has_role(_user_id, _role)` security definer
- `plans` (nome, preço_mensal, preço_anual, recursos jsonb, limites jsonb, ativo)
- `subscriptions` (user_id, plan_id, status [`ativo`,`teste`,`pendente`,`vencido`,`bloqueado`], started_at, expires_at, last_payment_at, trial_ends_at)
- `payments` (subscription_id, valor, método, status [`pago`,`pendente`,`vencido`,`cancelado`], paid_at, due_at)
- `coupons` (código, desconto, validade, uso)
- `activation_tokens` (user_id, token, expires_at, used_at) — para link de ativação
- `access_logs` (user_id, ip, user_agent, created_at)
- `admin_settings` (chaves gerais do sistema)
- RLS: cliente vê só o que é dele; admin vê tudo via `has_role(uid,'admin')`
- GRANTs corretos para `authenticated` e `service_role`

**Gate de rota:**
- `/_authenticated/route.tsx` já existe; adiciono verificação de role e status da assinatura
- Se role=admin → redireciona para `/admin`
- Se role=cliente e assinatura `vencido`/`bloqueado` → tela "Assinatura vencida"
- Novo layout `/_authenticated/_admin/route.tsx` que só permite admin

---

## Fase 2 — Área Admin Master (`/admin/*`)

Rotas:
- `/admin` — Dashboard (cards: total clientes, ativos, em teste, vencidos, bloqueados, MRR, receita anual, novos do mês, vencendo em 7d) + gráficos
- `/admin/clientes` — listar, criar, editar, excluir, bloquear/desbloquear, renovar, trocar plano, adicionar dias grátis, ver detalhes
- `/admin/assinaturas` — gerenciar assinaturas ativas/vencidas
- `/admin/pagamentos` — listar, marcar pago manual, registrar pagamento, histórico
- `/admin/planos` — CRUD de planos
- `/admin/cupons` — CRUD de cupons
- `/admin/relatorios` — receita mensal/anual, crescimento, ticket médio, gráficos
- `/admin/configuracoes` — config gerais
- `/admin/logs` — logs de acesso/sistema

Sidebar e tema verde (paleta SaaS).

---

## Fase 3 — Fluxo de criação de cliente + ativação

- Server function `createClient`: admin cria conta via `supabaseAdmin`, gera `activation_token`, cria assinatura em `teste`
- Rota pública `/ativar-conta/$token` — cliente define senha; ativa conta
- E-mail/Whatsapp de ativação (por enquanto exibir link no painel admin; integração de envio opcional)

---

## Fase 4 — Automações de assinatura

- Server route `/api/public/cron/check-subscriptions` (chamada por pg_cron)
- Atualiza status: vence em 7/3/0 dias → marca alertas; +7 dias após vencimento → `bloqueado`
- Quando pagamento confirmado → libera acesso

---

## Fase 5 — Área Cliente (refino)

- App atual continua funcionando como dashboard cliente
- Adicionar tela "Assinatura vencida" bloqueando acesso
- Página `/minha-assinatura` mostrando plano, vencimento, histórico de pagamentos
- Checkout público de pedidos (`/pedido/$slug`) já existe parcialmente — revisar

---

## Fase 6 — Design SaaS premium

- Paleta verde principal (#16a34a), verde escuro, brancos/cinzas
- Atualizar tokens em `src/styles.css`
- Componentes consistentes em ambas áreas

---

## Detalhes técnicos

- Stack: TanStack Start + Supabase (já configurado)
- Server functions `createServerFn` + `requireSupabaseAuth` para tudo do admin (+ verificação `has_role(uid,'admin')`)
- `supabaseAdmin` somente em handlers, importado via `await import(...)`
- Roles **nunca** no profile — tabela separada `user_roles` + função `has_role` security definer
- Pagamentos: por enquanto **manuais** (admin marca pago). Integração Stripe/Mercado Pago fica como fase opcional

---

## Perguntas antes de começar

1. **Por onde começo?** Posso entregar **Fase 1 + Fase 2 (dashboard admin + CRUD clientes/planos)** nesta primeira rodada. Pagamentos manuais, automações e ativação por e-mail viriam nas rodadas seguintes. Confirma?
2. **Envio do link de ativação:** mostro só no painel admin (você copia e envia pelo Whatsapp manualmente) ou já configuro envio por e-mail (precisaria de connector tipo Resend)?
3. **Pagamentos online:** quer integrar Stripe/Mercado Pago agora, ou começamos só com marcação manual de pagamento pelo admin?
4. **Primeiro admin:** vou criar um seed para promover **o seu usuário atual** a `admin` automaticamente. Me confirma o e-mail que está logado, ou prefere criar um novo?

Responde essas 4 perguntas que eu já parto para a implementação da Fase 1+2.