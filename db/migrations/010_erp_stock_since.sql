-- Dia em que o controle de estoque de um produto começou (a contagem inicial). Vendas que chegam das
-- integrações com data anterior a esse dia não baixam o estoque: já estavam refletidas na contagem.
-- Produtos que já controlavam estoque antes desta migração ficam sem data e seguem como sempre (baixam sempre).
alter table erp_products add column stock_since date;
