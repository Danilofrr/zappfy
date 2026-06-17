## Push Notifications de Vendas — Plano de Implementação

Sistema completo de Web Push nativo (sem OneSignal) para notificar o administrador sempre que uma nova venda for finalizada no checkout público.

---

### 1. Banco de dados (migration)

Nova tabela `public.notification_subscriptions`:
- `id` (uuid)
- `user_id` (uuid → auth.users)
- `endpoint` (text, unique)
- `p256dh` (text)
- `auth` (text)
- `user_agent` (text)
- `created_at`, `updated_at`

RLS: usuário só lê/escreve suas próprias subscriptions. `service_role` total.
Grants padrão para `authenticated` + `service_role`.

Alterar `submit_public_order` para retornar também o `total` e disparar um `pg_notify`/trigger? → mais simples: **trigger AFTER INSERT** em `public.orders` que chama `net.http_post` para um endpoint público assinado, OU usar um server route invocado direto pelo checkout após sucesso.

**Escolha:** invocar push diretamente no handler de submit-order após `submit_public_order` retornar o `order_id`. Buscamos o pedido (total, produto) com `supabaseAdmin` e enviamos web push a todas subscriptions do `owner_id`. Mais simples, sem extensões pg_net.

### 2. VAPID keys

Gerar par VAPID e salvar como secrets:
- `VAPID_PUBLIC_KEY` (também exposta como `VITE_VAPID_PUBLIC_KEY` para o cliente)
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (mailto:)

Usar `web-push` (npm) no server route.

### 3. Service Worker

`public/sw.js` — handler `push` (mostra notificação com logo) e `notificationclick` (abre `/pedidos`).

Registrado apenas em produção/published (não no preview Lovable), via wrapper guard.

### 4. Manifest PWA

Atualizar `public/manifest.webmanifest` com:
- name, short_name "ZappFy"
- icons 192/512 (gerar via imagegen com a logo)
- display standalone, theme/background colors
- start_url "/"

Adicionar `<link rel="manifest">`, `theme-color`, `apple-touch-icon` no `__root.tsx`.

### 5. Server routes / functions

**`/api/public/submit-order`** (já existe): após criar o pedido, chama helper `sendOrderPushNotification(orderId)` que:
1. Carrega o pedido via `supabaseAdmin`.
2. Busca todas `notification_subscriptions` do `user_id` dono da loja.
3. Envia web push com `{ title: "🔔 Nova venda realizada", body: "Valor: R$ X", icon: "/icon-192.png", data: { url: "/pedidos" } }`.
4. Remove subscriptions que retornarem 410/404.

**Server functions autenticadas** (`src/lib/notifications.functions.ts`):
- `saveSubscription({ endpoint, p256dh, auth, userAgent })` — upsert.
- `deleteSubscription({ endpoint })`.
- `sendTestNotification()` — envia push de teste só para o user logado.

### 6. UI — Configurações > Notificações

Nova aba/seção em `src/routes/_authenticated/configuracoes.tsx` (ou nova rota se preferir):
- Botão "Ativar notificações no celular" → pede permissão, registra SW, faz subscribe com VAPID public key, salva no banco.
- Status: ativo/inativo no dispositivo atual.
- Botão "Enviar notificação de teste".
- Botão "Desativar neste dispositivo".

### 7. Ícones & identidade

Gerar logo "ZappFy" com `imagegen` em 512x512 (premium, transparente). Derivar 192x192 via sharp? — sem sharp no sandbox; gerar dois tamanhos separadamente. Salvar em `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` (180), `public/favicon.png`.

Atualizar todos os refs (manifest, head, install prompt).

### 8. Dependências

`bun add web-push` (server).
Tipos: `@types/web-push`.

---

### Verificação final
- Reproduzir fluxo: ativar push em /configuracoes → enviar teste → criar pedido via checkout público → confirmar notificação chega com valor real e logo.
- Confirmar que checkout permanece público e dashboard protegida.
- Confirmar PWA instalável (manifest válido).

### Pontos abertos
1. **Logo**: você tem uma logo oficial para enviar, ou posso gerar uma para o ZappFy (estilo moderno, monograma "Z" em verde/whatsapp)?
2. **Incluir nome do produto** na mensagem da notificação (opcional segundo o brief)? Recomendo sim: `Produto: X · R$ 269,90`.
3. **Click na notificação** abre `/pedidos` no app — confirmar.
