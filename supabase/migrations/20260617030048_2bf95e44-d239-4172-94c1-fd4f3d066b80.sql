ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS motoboy_message_template TEXT DEFAULT '🛵 *Nova entrega*

*Cliente:* {cliente}
*Telefone:* {telefone}
*Endereço:* {endereco}
*Mapa:* {mapa}

*Itens:*
{itens}

*Pagamento:* {pagamento}
*Total:* {total}
*Obs:* {observacoes}',
  ADD COLUMN IF NOT EXISTS delivery_message_template TEXT DEFAULT 'Oba! 🚚 Seu pedido{produto} acabou de sair para entrega!

Olá *{cliente}*, tudo bem? Em instantes você o receberá no endereço:
{endereco}

Qualquer dúvida é só chamar por aqui. 💜
— {loja}';