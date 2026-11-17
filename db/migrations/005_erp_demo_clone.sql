-- Ambiente de demonstração: cada visitante ganha uma cópia própria de um modelo (tenant "demo-template"),
-- feita em uma única chamada ao banco. As cópias são apagadas depois de 24 h.

create or replace function erp_purge_tenant(t text) returns void language plpgsql as $$
begin
  delete from erp_titles where tenant = t;
  delete from erp_recurring where tenant = t;
  delete from erp_invoices where tenant = t;
  delete from erp_stock_moves where tenant = t;
  delete from erp_sales where tenant = t;
  delete from erp_purchases where tenant = t;
  delete from erp_products where tenant = t;
  delete from erp_parties where tenant = t;
  delete from erp_categories where tenant = t;
  delete from erp_accounts where tenant = t;
  delete from erp_interest where tenant = t;
  delete from erp_company where tenant = t;
end $$;

create or replace function erp_clone_tenant(src text, dst text) returns void language plpgsql as $$
begin
  insert into erp_company (tenant, name, trade_name, document, email, phone, zip, street, number, district, city, state,
                           next_sale_number, next_purchase_number, has_demo, allow_negative_stock)
    select dst, 'Empresa de demonstração', trade_name, document, email, phone, zip, street, number, district, city, state,
           next_sale_number, next_purchase_number, has_demo, allow_negative_stock
      from erp_company where tenant = src;

  create temp table m_cat on commit drop as select id as o, gen_random_uuid() as n from erp_categories where tenant = src;
  insert into erp_categories (id, tenant, name, kind) select m.n, dst, c.name, c.kind from erp_categories c join m_cat m on m.o = c.id;

  create temp table m_acc on commit drop as select id as o, gen_random_uuid() as n from erp_accounts where tenant = src;
  insert into erp_accounts (id, tenant, name, kind, initial_balance, active) select m.n, dst, a.name, a.kind, a.initial_balance, a.active from erp_accounts a join m_acc m on m.o = a.id;

  create temp table m_par on commit drop as select id as o, gen_random_uuid() as n from erp_parties where tenant = src;
  insert into erp_parties (id, tenant, is_customer, is_supplier, person_type, name, trade_name, document, email, phone, zip, street, number, complement, district, city, state, notes, status, demo)
    select m.n, dst, p.is_customer, p.is_supplier, p.person_type, p.name, p.trade_name, p.document, p.email, p.phone, p.zip, p.street, p.number, p.complement, p.district, p.city, p.state, p.notes, p.status, p.demo
      from erp_parties p join m_par m on m.o = p.id;

  create temp table m_prod on commit drop as select id as o, gen_random_uuid() as n from erp_products where tenant = src;
  insert into erp_products (id, tenant, sku, name, kind, unit, category, cost_price, sale_price, track_stock, min_stock, active, notes, demo)
    select m.n, dst, p.sku, p.name, p.kind, p.unit, p.category, p.cost_price, p.sale_price, p.track_stock, p.min_stock, p.active, p.notes, p.demo
      from erp_products p join m_prod m on m.o = p.id;

  create temp table m_sale on commit drop as select id as o, gen_random_uuid() as n from erp_sales where tenant = src;
  insert into erp_sales (id, tenant, number, customer_id, status, issue_date, subtotal, discount, total, payment_method, notes, confirmed_at, demo)
    select m.n, dst, s.number, (select n from m_par where o = s.customer_id), s.status, s.issue_date, s.subtotal, s.discount, s.total, s.payment_method, s.notes, s.confirmed_at, s.demo
      from erp_sales s join m_sale m on m.o = s.id;
  insert into erp_sale_items (sale_id, product_id, description, qty, unit_price, unit_cost, discount, total, position)
    select (select n from m_sale where o = i.sale_id), (select n from m_prod where o = i.product_id), i.description, i.qty, i.unit_price, i.unit_cost, i.discount, i.total, i.position
      from erp_sale_items i where i.sale_id in (select o from m_sale);

  create temp table m_pur on commit drop as select id as o, gen_random_uuid() as n from erp_purchases where tenant = src;
  insert into erp_purchases (id, tenant, number, supplier_id, status, issue_date, subtotal, discount, total, payment_method, notes, received_at, demo)
    select m.n, dst, s.number, (select n from m_par where o = s.supplier_id), s.status, s.issue_date, s.subtotal, s.discount, s.total, s.payment_method, s.notes, s.received_at, s.demo
      from erp_purchases s join m_pur m on m.o = s.id;
  insert into erp_purchase_items (purchase_id, product_id, description, qty, unit_cost, total, position)
    select (select n from m_pur where o = i.purchase_id), (select n from m_prod where o = i.product_id), i.description, i.qty, i.unit_cost, i.total, i.position
      from erp_purchase_items i where i.purchase_id in (select o from m_pur);

  create temp table m_rec on commit drop as select id as o, gen_random_uuid() as n from erp_recurring where tenant = src;
  insert into erp_recurring (id, tenant, direction, description, party_id, category_id, amount, day, active, demo)
    select m.n, dst, r.direction, r.description, (select n from m_par where o = r.party_id), (select n from m_cat where o = r.category_id), r.amount, r.day, r.active, r.demo
      from erp_recurring r join m_rec m on m.o = r.id;

  insert into erp_stock_moves (tenant, product_id, qty, unit_cost, reason, ref_type, ref_id, note, demo, created_at)
    select dst, (select n from m_prod where o = s.product_id), s.qty, s.unit_cost, s.reason, s.ref_type,
           case s.ref_type when 'sale' then (select n from m_sale where o = s.ref_id) when 'purchase' then (select n from m_pur where o = s.ref_id) end,
           s.note, s.demo, s.created_at
      from erp_stock_moves s where s.tenant = src;

  insert into erp_titles (tenant, direction, description, party_id, category_id, account_id, amount, due_date, status, paid_at, paid_amount, origin_type, origin_id, installment_no, installment_total, competence, notes, demo)
    select dst, t.direction, t.description, (select n from m_par where o = t.party_id), (select n from m_cat where o = t.category_id), (select n from m_acc where o = t.account_id),
           t.amount, t.due_date, t.status, t.paid_at, t.paid_amount, t.origin_type,
           case t.origin_type when 'sale' then (select n from m_sale where o = t.origin_id) when 'purchase' then (select n from m_pur where o = t.origin_id) when 'recurring' then (select n from m_rec where o = t.origin_id) end,
           t.installment_no, t.installment_total, t.competence, t.notes, t.demo
      from erp_titles t where t.tenant = src;
end $$;

-- as funções também ficam fora da API pública do Supabase (PUBLIC tem execução por padrão)
revoke all on function erp_purge_tenant(text) from public;
revoke all on function erp_clone_tenant(text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function erp_purge_tenant(text) from anon;
    revoke all on function erp_clone_tenant(text, text) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function erp_purge_tenant(text) from authenticated;
    revoke all on function erp_clone_tenant(text, text) from authenticated;
  end if;
end $$;
