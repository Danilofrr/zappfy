## Módulo de Rastreamento de Entregas em Tempo Real

Adicionar ao Zappfy um sistema completo de rastreamento ao vivo, ligado aos pedidos existentes, com mapa, link público para o cliente, link do motoboy via navegador, e personalização por loja.

---

### 1. Banco de dados (migração Supabase)

**Tabela `delivery_tracking`**
- `id`, `order_id` (FK orders), `store_id` (= user_id do lojista)
- `tracking_code` (público, único) e `courier_token` (motoboy, único) — gerados via `gen_random_uuid()` / base36 curto
- `courier_name`, `courier_phone`, `notes`
- `status` enum: `preparando | aguardando_motoboy | saiu_para_entrega | chegando | entregue | cancelado`
- `latitude`, `longitude`, `speed`, `heading`, `accuracy`, `last_updated_at`
- `started_at`, `completed_at`, `estimated_arrival`
- `customer_view_count`, `created_at`, `updated_at`

**Tabela `delivery_tracking_settings`** (1 por loja)
- store_id, logo_url, primary_color, secondary_color, background_color, button_color, text_color
- tracking_page_title, tracking_page_subtitle, welcome_message, delivered_message
- support_whatsapp
- show_store_logo, show_courier_name, show_courier_phone, show_estimated_time, show_distance

**RLS / GRANTs**
- Lojista (authenticated) só lê/escreve onde `store_id = auth.uid()`.
- Acesso público (anon) só via funções SECURITY DEFINER:
  - `get_tracking_public(_code)` — retorna dados seguros + settings (sem courier_phone se desativado)
  - `update_courier_location(_token, lat, lng, speed, heading, accuracy)`
  - `update_courier_status(_token, status)`
  - `increment_tracking_view(_code)`
- Realtime habilitado em `delivery_tracking`.

---

### 2. Painel do lojista — dentro do pedido (`pedidos.tsx`)

Nova seção **"Rastreamento da Entrega"** no card/dialog do pedido:
- Estado atual com badge colorida + última atualização (relativa)
- Se ainda não há tracking: botão **Gerar Rastreamento** abre dialog (nome motoboy, telefone, observação)
- Se já existe:
  - Mini-mapa Leaflet com posição do motoboy (atualizado via Realtime)
  - Nome/telefone do motoboy
  - Botões: Copiar Link Cliente, Copiar Link Motoboy, Enviar Cliente WhatsApp, Enviar Motoboy WhatsApp, Cancelar Rastreamento

Mensagens WhatsApp prontas conforme especificação.

---

### 3. Página do motoboy — `/entrega/$courierToken` (pública)

Layout mobile-first com:
- Logo + nome da loja, número do pedido, endereço completo + ponto de referência, nome/telefone do cliente, observação
- Status atual destacado
- Botões:
  - **Permitir localização** (testa permissão)
  - **Iniciar Entrega** → `watchPosition`, status → `saiu_para_entrega`, envia coords a cada movimento (throttle 5s/15m)
  - **Abrir rota no Google Maps** (URL com endereço)
  - **Estou chegando** → status `chegando`
  - **Finalizar Entrega** → para watch, status `entregue`
- Avisos: permissão negada, manter tela aberta, `wake lock` quando suportado
- Indicador "Enviando localização…" + último envio bem sucedido

---

### 4. Página pública do cliente — `/rastreio/$trackingCode`

Design premium responsivo, identidade Zappfy (verde, cards arredondados, sombras suaves):
1. **Header**: logo + nome loja + "Acompanhe sua entrega em tempo real" + badge status
2. **Card principal**: número pedido, status, mensagem dinâmica por status
3. **Mapa Leaflet** (OpenStreetMap — sem chave de API), ícone de motinha SVG, recentraliza, marker do endereço se geocodificado (best-effort via Nominatim quando possível, sem bloquear)
4. **Infos em tempo real**: última atualização, distância aprox., ETA simples (distância / velocidade média), nome motoboy (se ativo), botão WhatsApp suporte
5. **Timeline visual**: Confirmado → Preparando → Saiu para entrega → Chegando → Entregue (etapa atual destacada com glow)
6. **Footer**: "Rastreamento fornecido por Zappfy"

Atualizações via Supabase Realtime no `tracking_code`. Se `last_updated_at` > 2 min → "Aguardando nova atualização do entregador." Para de atualizar se `entregue` ou `cancelado`.

---

### 5. Configurações da página de rastreamento

Nova rota `_authenticated/personalizar-rastreamento.tsx`:
- Form com todos os campos de `delivery_tracking_settings`
- Color pickers, toggles (switches), inputs de texto
- **Preview ao vivo** da página do cliente ao lado (iframe ou render inline mockado)

Link no menu de Configurações.

---

### 6. Detalhes técnicos

- **Mapa**: Leaflet + OpenStreetMap tiles (sem necessidade de chave Google Maps; mantém projeto leve). Ícone de motinha em SVG inline.
- **Realtime**: `supabase.channel(...).on('postgres_changes', ...)` filtrando por `tracking_code` ou `id`, com cleanup em `useEffect`.
- **Throttling do motoboy**: envia se moveu > 15m ou passou 5s desde o último envio.
- **Wake Lock API** quando disponível para evitar sleep da tela do motoboy.
- **Segurança**: as 3 rotas públicas (cliente/motoboy/views) só interagem com o banco via funções `SECURITY DEFINER` — RLS permanece restritiva.

---

### Arquivos criados / alterados

- `supabase/migrations/<novo>.sql` — tabelas, enum, RLS, GRANTs, funções públicas, realtime
- `src/routes/rastreio.$trackingCode.tsx` — página pública do cliente
- `src/routes/entrega.$courierToken.tsx` — página do motoboy
- `src/routes/_authenticated/personalizar-rastreamento.tsx` — configurações
- `src/components/DeliveryTrackingPanel.tsx` — seção dentro do pedido
- `src/components/TrackingMap.tsx` — mapa Leaflet reutilizável
- `src/lib/tracking.ts` — helpers (links, distância, formatação, mensagens WhatsApp)
- `src/routes/_authenticated/pedidos.tsx` — integra o painel
- `src/routes/_authenticated/configuracoes.tsx` — link para a nova personalização
- `package.json` — adicionar `leaflet` e `react-leaflet`

Confirma para eu já começar pela migração?
