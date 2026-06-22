## Central de Entregas Zappfy

Evoluir a página do motoboy atual (`/entrega/$courierToken`) para uma Central de Entregas Zappfy, mantendo a página individual de entrega intacta e adicionando uma nova camada de "hub" por loja.

---

### 1. Nova rota: `/entregas-zappfy/$storeSlug`

Página pública (sem login) com **identidade Zappfy** (não usa o tema da loja):
- Header com logo e nome "Entregas Zappfy" (configurável pelo Admin Master)
- Título: "Central de Entregas — {Nome da Loja}"
- Lista de **Entregas Disponíveis** (status `aguardando_motoboy`, sem `courier_token` aceito ainda)
- Lista de **Minhas Entregas em Andamento** (já aceitas por este dispositivo, status `saiu_para_entrega` / `chegando`)

Cada card mostra:
- Número do pedido (#XXXX)
- Nome do cliente
- Endereço + bairro + cidade
- Horário do pedido
- Status (badge)
- Botão **Aceitar Entrega** (disponíveis) ou **Continuar entrega** (em andamento)

A página faz polling/realtime de novas entregas pelo `store_id` derivado do slug.

---

### 2. Fluxo de criação automática

Quando o pedido muda para "Saiu para Entrega" no painel de pedidos:
- Já existe a criação de tracking via `DeliveryTrackingPanel`. Vamos adicionar:
  - Um novo botão/atalho **"Enviar para Central de Entregas"** que cria o rastreamento sem precisar preencher nome/telefone do motoboy (campos ficam nulos até alguém aceitar)
  - Status inicial: `aguardando_motoboy`
- O rastreamento já criado aparece automaticamente na Central da loja correspondente.

---

### 3. Aceitar entrega

Botão **Aceitar Entrega** chama nova função `accept_delivery(_tracking_code, _courier_name?, _courier_phone?)`:
- Valida que o tracking pertence à loja do slug
- Valida que ainda não foi aceito (sem alterações de status ainda)
- Marca como "aceito" (preenche `courier_name` se informado, mantém `aguardando_motoboy`)
- Retorna o `courier_token`
- Frontend redireciona para `/entrega/$courierToken` (página existente, sem mudanças)

O `courier_token` aceito é guardado em `localStorage` (chave por loja) para listar "Minhas Entregas em Andamento" depois.

---

### 4. Identidade visual Zappfy (Admin Master)

Nova tabela `zappfy_central_settings` (linha única, singleton):
- `logo_url`, `header_color`, `header_text_color`
- `background_color`, `card_color`, `card_border_color`, `card_shadow_color`, `card_radius`
- `text_color`, `title_color`, `button_color`, `button_text_color`, `icon_color`
- `footer_text`

RLS:
- `SELECT` público (anon) — leitura via RPC `get_zappfy_central_settings()`
- `UPDATE/INSERT` só para `has_role(auth.uid(), 'admin')`

Nova seção na rota `_authenticated/admin.configuracoes.tsx` (ou nova rota admin): **"Entregas Zappfy"** com form de personalização. Lojistas **não** acessam.

---

### 5. RPCs novas

- `get_store_by_slug(_slug)` → `{ store_id, store_name }` (público)
- `list_available_deliveries(_slug)` → entregas em `aguardando_motoboy` daquela loja (público)
- `list_active_deliveries(_slug, _tokens text[])` → entregas em andamento que o motoboy aceitou (público, filtrado por tokens conhecidos)
- `accept_delivery(_tracking_code, _courier_name, _courier_phone)` → `{ courier_token }` (público, valida loja)
- `get_zappfy_central_settings()` → tema Zappfy (público)

---

### 6. Painel do lojista — pequeno ajuste

No `DeliveryTrackingPanel.tsx`:
- Adicionar botão **"Copiar link da Central de Entregas"** que copia `{origin}/entregas-zappfy/{slug}` (uma vez, exibido em qualquer pedido com tracking)
- Quando criar tracking sem informar motoboy, status fica `aguardando_motoboy` e aparece automaticamente na Central

---

### Arquivos

**Migração:**
- Nova `zappfy_central_settings` + RLS + GRANTs
- Novas funções SECURITY DEFINER acima
- Permitir `courier_name`/`courier_phone` nulos em `delivery_tracking` (se ainda não forem)

**Novos:**
- `src/routes/entregas-zappfy.$storeSlug.tsx` — Central de Entregas
- `src/routes/_authenticated/admin.entregas-zappfy.tsx` — personalização Admin Master (ou seção dentro de admin.configuracoes)

**Editados:**
- `src/components/DeliveryTrackingPanel.tsx` — botão copiar link da central
- `src/integrations/supabase/types.ts` — auto-regenerado
- `src/routes/_authenticated/admin.tsx` — adicionar link no menu admin

**Não alterar:**
- `src/routes/rastreio.$trackingCode.tsx` (página do cliente)
- `src/routes/entrega.$courierToken.tsx` (página individual do motoboy, só recebe redirect)

Confirma que posso começar pela migração?
