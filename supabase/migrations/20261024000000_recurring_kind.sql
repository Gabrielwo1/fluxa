-- Lançamentos recorrentes manuais: além das contas fixas (saídas), cobranças e entradas
-- mensais de clientes, só para controle (não vêm do Open Finance).
alter table public.fixed_bills
  add column if not exists kind text not null default 'out' check (kind in ('out', 'in'));
