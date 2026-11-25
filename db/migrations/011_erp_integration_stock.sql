-- Produtos que vieram das integrações passam a controlar estoque, e as vendas já importadas dão saída.
-- Sem nenhuma entrada cadastrada o saldo fica negativo: é exatamente o que já saiu. Compras ou uma
-- contagem (Ajustar) acertam depois. Só mexe em produto criado pela integração (marca em "notes");
-- produto cadastrado à mão continua como o usuário deixou. Pode rodar de novo: não repete saída.

update erp_products
   set track_stock = true, stock_since = null, updated_at = now()
 where kind = 'product' and not track_stock and notes like 'Criado pela integração:%';

insert into erp_stock_moves (tenant, product_id, qty, unit_cost, reason, ref_type, ref_id, note, created_at)
select s.tenant, i.product_id, -sum(i.qty), 0, 'sale', 'sale', s.id, 'Venda #' || s.number,
       (s.issue_date + time '12:00') at time zone 'America/Sao_Paulo'
  from erp_sale_items i
  join erp_sales s on s.id = i.sale_id
  join erp_products p on p.id = i.product_id
 where s.status = 'confirmed' and p.track_stock and p.notes like 'Criado pela integração:%'
   and not exists (select 1 from erp_stock_moves m where m.tenant = s.tenant and m.ref_type = 'sale' and m.ref_id = s.id and m.product_id = i.product_id)
 group by s.tenant, i.product_id, s.id, s.number, s.issue_date;
