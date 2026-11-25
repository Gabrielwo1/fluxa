-- A sincronização passa a andar do dia mais novo para o mais antigo: o intervalo já buscado é
-- [synced_from, synced_until], sempre contínuo até hoje. Linhas antigas (só com synced_until) valem
-- como um intervalo de um dia; a próxima rodada completa o resto.
alter table erp_sync_state add column synced_from date;
