# Integrações: atendente, loja virtual e Mercado Livre

Os dados da Veipar chegam ao Fluxa de duas formas que usam o **mesmo caminho** por dentro (e por isso nunca
duplicam: cada registro traz o id que tem na origem, `external_id`):

1. **Busca automática (principal).** A cada 3 horas o Fluxa entra nas origens e puxa o que mudou.
2. **Envio por quem tem a chave** (`POST /api/ingest`): para uma origem que prefira empurrar os dados.

```
Atendente Syntax ─ WhatsApp (contatos, vendas) ┐
                 └ Mercado Livre (pedidos, notas) ┼─ busca a cada 3 h ─▶ clientes · vendas · financeiro · notas
Loja Shopify ─ pedidos + acessos (funil) ────────┘                       ─▶ telas do ERP e /integracoes
```

Nada nos repositórios do atendente e da loja foi alterado: o Fluxa usa o que eles já expõem.

## 1. Busca automática

| Origem | Como o Fluxa lê | O que traz |
| --- | --- | --- |
| **Atendente** | Entra na API do painel com o **código de acesso** do cliente (a mesma sessão da equipe) e lê `/api/contacts` | Contatos do WhatsApp (viram leads, com anúncio de origem, ficha e observações) e vendas lançadas (viram pedidos pagos) |
| **Mercado Livre** | **Pelo atendente**, que já tem a conta conectada e renova os tokens: usa a rota `?r=api` dele | Pedidos, comprador (CPF/CNPJ, endereço de entrega), pagamento e **nota fiscal (NF-e)** de cada pedido |
| **Loja** | Admin API da Shopify (mesmo app da loja) + o banco onde a loja grava os acessos | Pedidos, clientes e, por dia, visitas, carrinho, checkout e pedidos (o funil) |

Como funciona a cada rodada: cada origem lembra **o intervalo de dias já buscado** (`synced_from` a `synced_until`,
sempre contínuo até hoje) e anda do **dia mais novo para o mais antigo**, em janelas de 7 dias:

1. primeiro o **recente**: de onde parou até hoje, relendo os últimos dias (2 no atendente, 15 no Mercado Livre por
   causa da nota que sai depois, 3 na loja) para pegar pagamento, cancelamento e nota tardia. Na primeira vez são 7 dias,
   para o que acabou de vender aparecer logo;
2. depois o **histórico**, para trás, até `SYNC_BACKFILL_DAYS` dias (padrão 60).

Cada janela pronta é gravada na hora. Se o tempo da rodada acabar (240 s), a próxima continua de onde parou; o card mostra
"Importando histórico" e até que data já tem. Pedido do Mercado Livre que já está no Fluxa não repete a consulta de
endereço e nota, então reler é barato. O histórico maior vem com o comando abaixo.

### Ligar (uma vez)

1. Aplicar as migrações no banco de produção: `npm run erp:migrate` (007 e 008).
2. Cadastrar as credenciais na Vercel, escondidas, com o assistente:
   ```bash
   bash scripts/conectar-origens.sh
   ```
   Ele pergunta o endereço e o código do atendente, e os dados do app Admin da Shopify (opcional: o banco dos
   acessos da loja), e guarda tudo como variável sensível. As variáveis, se preferir cadastrar à mão
   (sufixo = slug da empresa em maiúsculas):

   | Variável | Para quê |
   | --- | --- |
   | `ATENDENTE_URL_MIRANDA`, `ATENDENTE_CODE_MIRANDA`, `ATENDENTE_SLUG_MIRANDA` (padrão `veipar`) | atendente + Mercado Livre |
   | `SHOPIFY_DOMAIN_MIRANDA` (`xxx.myshopify.com`), `SHOPIFY_CLIENT_ID_MIRANDA`, `SHOPIFY_CLIENT_SECRET_MIRANDA` | pedidos da loja |
   | `LOJA_SUPABASE_URL_MIRANDA`, `LOJA_SUPABASE_KEY_MIRANDA` (service role) | visitas e funil da loja (opcional) |
   | `CRON_SECRET` | já usada pelo agendador; a rota `/api/cron/sync` confere |
3. Publicar. O agendador (`vercel.json`, `0 */3 * * *`) passa a rodar sozinho. Na tela **Integrações** há o botão
   **Sincronizar agora** e, em cada origem, quando foi a última busca e o motivo se falhou.

> **Plano da Vercel:** o plano Hobby só aceita agendamento **diário**; a cada 3 horas exige o plano Pro. No Hobby,
> troque o horário em `vercel.json` para diário ou chame `GET /api/cron/sync` (com `Authorization: Bearer $CRON_SECRET`)
> de um agendador externo.

### Histórico e rodada manual

A função do agendador tem teto de 60 s; para trazer meses de pedidos use o comando, sem esse limite (continua de
onde parou se a origem for grande):

```bash
npm run sync -- --tenant miranda --from 2026-01-01
npm run sync -- --tenant miranda --source mercadolivre
```

Ele lê as mesmas variáveis do servidor e o `DATABASE_URL` (do ambiente ou do `.env.local`). A Shopify só devolve
pedidos dos últimos 60 dias sem a permissão `read_all_orders` no app.

### Se algo falhar

- Uma origem que falha (login recusado, loja fora do ar) **não derruba as outras** e **não avança a data**: a
  próxima rodada tenta de novo do mesmo ponto. O erro aparece no card da origem.
- Um pedido que falha (ex.: venda de produto com estoque controlado e sem saldo) vira "itens com erro" no histórico
  de envios e é tentado de novo enquanto estiver na janela recente.
- Se a Shopify negar o acesso aos dados pessoais, os pedidos entram **sem cliente** e a tela mostra um aviso.

## 2. Envio por quem tem a chave (`POST /api/ingest`)

Uma origem que prefira empurrar os dados usa a chave da empresa; ela diz de qual empresa são os dados, então o
corpo nunca escolhe o tenant.

1. Criar a chave (variável **sensível**, mínimo 24 caracteres; várias separadas por vírgula valem juntas):
   `openssl rand -hex 32` e `vercel env add INGEST_KEY_MIRANDA production --sensitive`.
2. Testar: `curl -H "Authorization: Bearer <chave>" https://<fluxa>/api/ingest` devolve `{"ok":true,"tenant":"miranda",…}`.

### Formato do corpo

Corpo JSON (até 500 itens por lista e 6 MB por envio):

```jsonc
{
  "source": "atendente" | "loja" | "mercadolivre",
  "customers": [ { "external_id", "name", "phone", "email", "document", "zip", "street", "number", "complement",
                   "district", "city", "state", "origin", "first_contact_at", "lead" } ],
  "orders":    [ { "external_id", "number", "issue_date", "status": "paid" | "pending" | "canceled", "paid_at",
                   "payment_method", "items": [ { "sku", "description", "qty", "unit_price", "discount" } ],
                   "shipping", "discount", "total", "notes", "customer": { …como acima… }, "invoice": { … } } ],
  "invoices":  [ { "external_id", "kind": "nfe" | "nfse", "number", "access_key", "issue_date", "amount",
                   "status": "issued" | "canceled", "customer_name", "customer_document", "xml",
                   "order_external_id" } ],
  "stats":     [ { "day": "AAAA-MM-DD", "visitors", "sessions", "product_views", "add_to_cart", "checkouts",
                   "orders", "revenue" } ]
}
```

Resposta: contagem de criados/atualizados/sem mudança e `errors` (registro a registro, com o motivo). **Um pedido
com erro não derruba os outros** do mesmo envio.

### O que o Fluxa faz com cada coisa

| Chegou | Resultado no ERP |
| --- | --- |
| Cliente | Cadastro novo, ou completa um existente. Acha o mesmo cliente por `external_id`, CPF/CNPJ válido ou telefone (últimos 11 dígitos, ignora o 55). **Só preenche o que está vazio**: o que a equipe editou não é sobrescrito. `lead: true` = ainda não comprou; vira cliente ativo na primeira venda. |
| Pedido `paid` | Venda **confirmada** com o recebimento já lançado na carteira do canal (WhatsApp, Loja virtual, Mercado Livre). |
| Pedido `pending` | Venda confirmada com **conta a receber em aberto** (precisa de cliente; sem cliente fica como orçamento). Quando o mesmo pedido chega depois como `paid`, a parcela é baixada. |
| Pedido `canceled` | Se já existia: desfaz o recebimento e cancela a venda. Se nunca existiu: entra cancelado, sem financeiro. |
| `shipping`, `total` | Frete vira um item "Frete". Se `total` difere dos itens, a diferença entra como "Ajuste do canal" (ou desconto) para o total da venda bater com o cobrado. |
| Item com `sku` | Liga ao produto do mesmo SKU; se não existe, cria **sem controle de estoque** (o saldo real continua na loja/marketplace). Item sem SKU fica só como descrição. |
| Nota (`invoice`) | Registra em Notas fiscais, ligada ao pedido; a chave de acesso evita duplicar. |
| `stats` | Um registro por canal e dia; reenviar o dia **sobrescreve**. Alimenta o funil em `/integracoes`. |

Venda confirmada não muda de itens ou valores (regra do ERP): só acompanha pagamento e cancelamento.

## 3. Estoque: relação com tudo que foi vendido

Em **Estoque → Vendido × estoque** cada produto aparece com o que já vendeu (no período e no total), **por canal**
(Mercado Livre, loja, WhatsApp, balcão), o ritmo por dia, o saldo que o Fluxa controla, quantos dias ele dura e
quanto comprar para cobrir 30 dias. Situações: Repor (acaba em até 7 dias ou abaixo do mínimo), Zerado, Contagem velha
(saiu mais do que a contagem tinha), Parado (tem saldo e não vendeu) e Em dia.

O produto que chega pelas integrações nasce **sem controle de estoque** (o saldo real continua na loja e no
marketplace). Para controlar, clique em **Controlar** e informe quanto tem hoje:

- a contagem vale **a partir de hoje** (`stock_since`): a partir daí cada venda baixa o saldo sozinha;
- vendas de dias **anteriores**, que ainda estão chegando do histórico, não baixam (já estavam na contagem);
- venda que vem de um canal **nunca é recusada** por falta de saldo (já aconteceu): o saldo fica negativo e o produto
  aparece como "Contagem velha" até uma nova contagem em Ajustar. Venda lançada à mão continua exigindo saldo;
- pedido cancelado no canal devolve o estoque.

O Fluxa **não lê** o estoque do Mercado Livre nem da Shopify; o saldo vem da contagem + vendas.

## 4. Limites conhecidos

- **Testes**: a busca foi validada contra servidores simulados do atendente, da Shopify e do banco de acessos
  (`npx tsx scripts/sync-test.ts`), **não contra os sistemas reais** (faltam as credenciais). Os campos de comprador,
  `billing_info`, endereço do envio e nota seguem o que o atendente já lê; confira o primeiro resultado em
  Integrações. O XML da nota não é baixado (só número, chave e valor).
- A receita do Mercado Livre é **bruta**: tarifas e frete pago pelo vendedor ainda não viram despesa.
- O recebimento entra na **data do pedido** (ou `paid_at`), não na data em que o marketplace libera o dinheiro.
- Sem limite de requisições na rota: a proteção é a chave. Guarde-a como variável sensível e use sempre HTTPS.
- Telefone, e-mail e CPF/CNPJ dos clientes passam a morar também no Fluxa (LGPD): o texto das conversas **não** é enviado.
