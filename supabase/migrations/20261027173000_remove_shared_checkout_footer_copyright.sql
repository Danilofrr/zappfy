-- Limpa o texto institucional da Esparta que foi herdado por outras lojas.
-- Preserva as lojas da Esparta e qualquer rodapé personalizado.
UPDATE public.settings
SET checkout_footer_copyright = ''
WHERE lower(store_name) NOT LIKE '%esparta%'
  AND checkout_footer_copyright = '© 2026 VILIES NEGOCIOS DIGITAIS CNPJ: 50.888.578/0001-02';
