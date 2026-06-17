UPDATE public.settings
SET motoboy_message_template = E'🛵 *NOVA ENTREGA*\n\n👤 *Cliente:* {cliente}\n📦 *Produto:* {produto}\n📍 *Endereço:* {endereco}\n🗺️ *Localização:* {mapa}\n📱 *Telefone:* {telefone}\n\n💰 *Pagamento:* {pagamento}\n💵 *Total:* {total}'
WHERE motoboy_message_template LIKE '%Itens:%' OR motoboy_message_template IS NULL;

ALTER TABLE public.settings
ALTER COLUMN motoboy_message_template SET DEFAULT E'🛵 *NOVA ENTREGA*\n\n👤 *Cliente:* {cliente}\n📦 *Produto:* {produto}\n📍 *Endereço:* {endereco}\n🗺️ *Localização:* {mapa}\n📱 *Telefone:* {telefone}\n\n💰 *Pagamento:* {pagamento}\n💵 *Total:* {total}';