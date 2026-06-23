# Sistema de Convite de Trial

## 1. Banco de dados (migração)

Nova tabela `public.trial_invites`:

- `code` (text, único, ~6-8 chars maiúsculos) — usado na URL `/trial/ABC123`
- `created_by` (uuid, admin que gerou)
- `label` (text, opcional — para identificar campanha)
- `trial_days` (int, default 7)
- `status` (text: `active` | `revoked`)
- `signups_count` (int, default 0) — incrementado a cada cadastro
- `conversions_count` (int, default 0) — incrementado quando vira `ativo`
- `expires_at` (opcional — validade do link em si)
- `revoked_at`

Nova coluna em `public.subscriptions`:
- `invite_code` (text, nullable) — rastreia origem do cadastro

Função SQL `redeem_trial_invite(_code text)` (SECURITY DEFINER) chamada pelo cliente após cadastro auth: cria settings/profile (via trigger já existente), cria/atualiza `subscriptions` com `status='teste'`, `trial_ends_at=now()+trial_days`, `expires_at=...`, `invite_code=_code`, incrementa `signups_count`. Valida que invite está `active` e não expirou.

Função `admin_trial_stats()` retorna agregados: ativos, expirados, convertidos, taxa de conversão.

## 2. Server functions (admin)

Em `src/lib/admin.functions.ts`:
- `listTrialInvites()` — lista convites + stats por convite
- `createTrialInvite({ label?, trialDays? })` — gera código aleatório único
- `revokeTrialInvite({ code })`
- `getTrialStats()` — chama `admin_trial_stats()`

Server fn pública (sem auth) `getTrialInviteInfo({ code })` em `src/lib/trial.functions.ts` — valida código e retorna `{ valid, trialDays, label }` para a página de cadastro mostrar "Você ganhará X dias grátis".

Server fn autenticada `redeemTrialInvite({ code })` — chamada logo após o cliente criar conta, chama a função SQL.

## 3. Rotas frontend

- `src/routes/admin.trials.tsx` (sob `_authenticated/admin`) — página com:
  - 4 cards de stats (ativos / expirados / convertidos / taxa)
  - Botão **Gerar Link de Trial** (dialog com label + dias)
  - Tabela de convites: código, label, dias, cadastros, conversões, status, ações (copiar link, revogar)
- `src/routes/trial.$code.tsx` (público) — landing que valida código, mostra "7 dias grátis no Zappfy" e formulário de cadastro (email + senha + nome da loja). Após `signUp` bem-sucedido, chama `redeemTrialInvite` e redireciona para `/`.
- Link no `AdminShell` nav: **Trials** (ícone Gift).

## 4. Dashboard do cliente

`SubscriptionStatusCard` (sidebar) já mostra dias de trial. Ajustar cores conforme especificado:
- 7–4 dias → verde
- 3–2 dias → amarelo
- 1 dia → vermelho

Adicionar **banner de alerta** quando dias restantes ≤ 3 no topo das páginas autenticadas: "Seu período de teste está terminando. Assine para continuar usando o Zappfy." + botão **Assinar Agora** → `/minha-assinatura`.

## 5. Bloqueio quando trial expira

Em `_authenticated/route.tsx` (gate de auth): após buscar `getMyAccess`, se `status` for `vencido` ou `teste` com `expires_at < now`, redirecionar para `/assinatura-bloqueada` (já existe). Whitelistar apenas: `/minha-assinatura`, `/assinatura-bloqueada`, `/configuracoes`.

## 6. Admin Clientes — coluna "Dias restantes"

Adicionar coluna na tabela `src/routes/_authenticated/admin.clientes.tsx` mostrando dias restantes calculados de `expires_at`.

## Detalhes técnicos

- Código do convite: 6 chars `A-Z0-9` (sem caracteres ambíguos), unicidade no DB com retry.
- URL gerada no client: `${origin}/trial/${code}`.
- `redeem_trial_invite` usa `auth.uid()` (SECURITY DEFINER + check `auth.uid() is not null`).
- Conversão = quando `subscriptions.status` muda para `ativo` e `invite_code` está set → trigger after-update incrementa `conversions_count`.
- RLS: `trial_invites` somente admin (via `has_role`); leitura pública mínima via RPC.

```text
/trial/:code  →  cadastro  →  redeem_trial_invite(code)
                              ↓
                  subscriptions(status=teste, trial_ends_at=+7d, invite_code)
                              ↓
                  dashboard sidebar: contador colorido
                              ↓
                  expira  →  /assinatura-bloqueada
                              ↓
                  assina  →  trigger: conversions_count++
```
