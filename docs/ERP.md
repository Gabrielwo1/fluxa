# Fluxa ERP: gestão geral da empresa

O Fluxa deixou de ser só um painel de Open Finance. Agora é um **ERP enxuto** para pequenas e médias
empresas, **sem emissão fiscal**: cadastros, vendas, compras, estoque, financeiro, relatórios e
painéis. O Open Finance (bancos conectados pela Pluggy) continua, como um grupo à parte do menu.

## O que é a base de um ERP (e como o Fluxa a cobre)

Um ERP de gestão geral gira em torno de cinco ideias. Tudo o mais é variação delas.

| Ideia | O que resolve | No Fluxa |
| --- | --- | --- |
| **Cadastros mestres** | Quem e o quê: pessoas e itens que se repetem em tudo | Clientes e fornecedores (`erp_parties`), produtos e serviços (`erp_products`), categorias, caixas e contas |
| **Documentos** | Eventos de negócio com itens e valores | Orçamento/venda (`erp_sales`), pedido de compra (`erp_purchases`) |
| **Livros** | Registro que nunca se apaga, só se corrige | Estoque (`erp_stock_moves`: o saldo é a soma das movimentações), financeiro (`erp_titles`: uma linha por parcela) |
| **Integração entre módulos** | Um evento dispara os outros sozinho | Venda confirmada → baixa estoque + gera contas a receber; compra recebida → soma estoque + atualiza custo + gera contas a pagar |
| **Análise** | Transformar registros em decisão | Painel inicial, fluxo de caixa projetado, 8 relatórios (vendas, margem, curva ABC, clientes, DRE, caixa, inadimplência, estoque) |

### Fluxos principais

```
VENDA    cliente ─ orçamento ─ confirmar ─┬─ estoque baixa (custo guardado p/ margem)
                                          └─ contas a receber (parcelas) ─ receber ─ caixa sobe
COMPRA   fornecedor ─ rascunho ─ receber ─┬─ estoque sobe + custo do produto atualiza
                                          └─ contas a pagar (parcelas) ─ pagar ─ caixa desce
RECORRÊNCIA  modelo mensal ─ "lançar do mês" ─ contas a pagar/receber (sem duplicar)
```

Regras que mantêm os números confiáveis:

- Vendas confirmadas e compras recebidas **não se editam**: cancelam-se (estoque volta, parcelas em
  aberto são canceladas). Parcela já recebida/paga exige **desfazer a baixa** antes.
- Cadastro com histórico **não se apaga**: fica Inativo.
- Estoque nunca fica negativo, a menos que a empresa permita (Configurações).
- Tudo que mexe em várias tabelas roda em **uma transação**: ou acontece inteiro, ou nada.
- Dinheiro é `numeric` (nunca float); parcelas dividem os centavos sem perder nada.
- “Hoje” é sempre o dia do Brasil (`erp_today()`), mesmo com o servidor em UTC.

## Telas (menu)

Início · Vendas e orçamentos · Clientes · Compras · Fornecedores · Produtos e serviços · Estoque ·
A receber · A pagar · Fluxo de caixa · Caixas e contas · Recorrências · Relatórios ·
Bancos (Open Finance: painel, transações, contas, investimentos, contas fixas) ·
Configurações · Ajuda e primeiros passos.

Didática embutida: botão **?** em cada página explicando em linguagem simples, estados vazios com o
próximo passo, checklist de **Primeiros passos** no Início, página de **Ajuda** com os fluxos e um
glossário, e **dados de exemplo** (carregam e apagam com um clique, sem tocar nos dados reais).

## Arquitetura

```
db/migrations/*.sql        esquema (aplicado por scripts/erp-migrate.ts)
lib/erp/db.ts              conexão (pg) e o filtro de tenant obrigatório
lib/erp/auth.ts            contexto da requisição, permissões, erros em português
lib/erp/schemas.ts         validação (zod) com mensagens em português
lib/erp/services/*.ts      regras de negócio (parties, products, stock, sales, purchases,
                           finance, dashboard, reports, search, demo)
app/api/erp/**             rotas HTTP finas, só chamam os serviços
components/erp/*           telas e componentes
scripts/erp-test.ts        teste das regras direto no banco
```

**Isolamento entre empresas.** Toda tabela tem `tenant` (o slug da empresa, o mesmo de
`clients.slug`). A função `q()` de `lib/erp/db.ts` **recusa qualquer SQL** que não filtre
`tenant = $1` (ou não insira o tenant), e o tenant vem sempre da sessão, nunca do navegador. O teste
confirma que a empresa B não enxerga nada da A.

**Quem pode gravar.** Acesso por código (MVP) e modo local editam o ERP; com Supabase vale o papel
(`viewer` só lê). Cada código de acesso é uma empresa própria, com os próprios dados.

## Colocando no ar

O ERP precisa de um Postgres. Qualquer um serve; o app só usa `DATABASE_URL`.

1. **Obtenha uma conexão Postgres.** O caminho mais curto: no terminal, `vercel integration add neon`
   (cria o banco já ligado ao projeto), ou use o Postgres do seu projeto Supabase
   (Settings → Database → Connection string).
2. **Rode uma vez:**

   ```bash
   DATABASE_URL='postgresql://usuario:senha@host:5432/banco' bash scripts/erp-setup.sh
   ```

   Ele cria as tabelas, guarda a variável na Vercel (sensível) e publica de novo.
3. Entre no painel: o ERP aparece como página inicial. Use **Carregar dados de exemplo** se quiser
   explorar antes de cadastrar os seus.

Local: `createdb fluxa_erp`, `DATABASE_URL=postgres://localhost/fluxa_erp` no `.env.local`,
`npm run erp:migrate`, `npm run dev`. Testes: `npx tsx scripts/erp-test.ts`.

> Sem `DATABASE_URL`, as telas do ERP mostram um aviso explicando o que falta, em vez de quebrar.

## Fora do escopo (de propósito)

- **Fiscal**: notas fiscais, impostos e SPED. As páginas de NFS-e continuam no código, mas saíram do
  menu. Nada do ERP depende delas.
- **Ordem de serviço, contratos, RH e folha, produção/BOM, multi-depósito, comissões.**

## Próximos passos sugeridos

1. **Conciliação**: casar as transações do Open Finance com contas a pagar/receber (já temos os dois
   lados no mesmo painel).
2. Edição de venda confirmada com histórico de alterações (`audit_log`).
3. Permissões por módulo (hoje: leitura x edição).
4. Ordens de serviço e contratos recorrentes com reajuste.
5. Importação de planilha (clientes e produtos) e exportação completa.
6. Anexos (comprovantes, fotos de produto).
