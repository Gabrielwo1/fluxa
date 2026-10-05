// Recategorização dos lançamentos. O banco costuma classificar compras no
// débito como "Shopping" e PIX como "Transfers", então a categoria final sai de:
//   1. regra do usuário para o estabelecimento
//   2. regras de palavras-chave (alta confiança)
//   3. aprendizado: se o banco acertou a categoria de outros lançamentos do
//      mesmo estabelecimento, ela vale para os genéricos
//   4. pagamentos a empresas em transferências
//   5. a categoria original do banco

export type CategoryRules = Record<string, string>;

const GENERIC = new Set([
  "Shopping",
  "Online shopping",
  "Services",
  "Transfers",
  "Transfer - PIX",
]);

// categorias que o app trata de forma especial; nunca são sobrescritas
const PROTECTED = new Set([
  "Investments",
  "Mutual funds",
  "Fixed income investment",
  "Variable income investment",
  "Credit card payment",
  "Same person transfer",
]);

// "Compra no débito|POSTO X 2/9" -> "POSTO X"
export function merchantKey(description: string): string {
  const parts = description
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
  const name = parts.length > 1 ? parts.slice(1).join(" ") : description;
  return name
    .toUpperCase()
    .replace(/\s*\d{1,2}\/\d{1,2}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const CARD_BILL = /\bPAGAMENTO (DE )?FATURA\b|\bPGTO\.? FATURA\b/i;

const KEYWORD_RULES: [RegExp, string][] = [
  [/\bAIQFOME\b|\bIFOOD\b|\bRAPPI\b|UBER ?EATS|\bDELIVERY\b/i, "Food delivery"],
  [/\bPOSTOS?\b|COMBUSTIVE|\bSHELL\b|\bIPIRANGA\b|\bPETROBRAS\b|GASOLINA/i, "Gas stations"],
  [
    /SUPERMERC|\bSUPER\b|\bMERCADO\b(?!\s*(PAGO|LIVRE))|MERCEARIA|ATACAD|HORTIFRUTI|ACOUGUE|SUPERDIA|SUPERVIZA|CELEIRO/i,
    "Groceries",
  ],
  [
    /RESTAURANTE|LANCH(E|ONETE|ES)\b|PIZZ|\bBAR\b|LOUNGE?|LOUNG\b|SUSHI|\bBEER\b|CHOPP|CHURRASC|HAMBURG|BURGER|\bCAFE\b|CAFETERIA|SORVET|PADARIA|FORNAIO|SAINT HONORE|DOGUINHO|ESPETINHO|BISTRO|PASTELARIA|ACAI|CONFEITARIA|DOCERIA/i,
    "Eating out",
  ],
  [/FARMACIA|\bDROGA(SIL|RIA|S)?\b|PANVEL|\bRAIA\b/i, "Pharmacy"],
  [/VETERINARI|PET ?SHOP|\bPETZ\b|COBASI|PETLOVE/i, "Pet supplies and vet"],
  [/\bHOTEL\b|POUSADA|\bINN\b|RESORT|AIRBNB|BOOKING/i, "Accomodation"],
  [/\bLATAM\b|\bGOL\b|\bAZUL\b|DECOLAR|PASSAGEM|AIRLINES/i, "Travel"],
  [/\bCOPEL\b|\bCELESC\b|\bCEMIG\b|\bENEL\b|ENERGIA/i, "Electricity"],
  [/SANEPAR|SABESP|AGUA E ESGOTO/i, "Utilities"],
  [/\bVIVO\b|\bCLARO\b|\bTIM\b|AMPERNET|TELECOM|TELECOMUNICACOES/i, "Telecommunications"],
  [/\bUBER\b|\b99 ?(POP|TAXI|TECNOLOGIA)\b|CABIFY|\bTAXI\b/i, "Taxi and ride-hailing"],
  [/IMOBILIARIA|ALUGUEL|CONDOMINIO|LOCACAO DE IMOVE/i, "Rent"],
  [/PROTECAO VEICULAR|\bSEGUROS?\b|PORTO SEGURO/i, "Insurance"],
  [/\bIOF\b/i, "Tax on financial operations"],
  [
    /RECEITA FEDERAL|\bDARF\b|\bDAS\b|SIMPLES NACIONAL|GOVERNO D[OA]|SECRETARIA (DE ESTADO|DA FAZENDA)|\bIPVA\b|\bIPTU\b|DETRAN|PREFEITURA/i,
    "Taxes",
  ],
  [/ESCOLA|COLEGIO|FACULDADE|UNIVERSIDADE|\bCURSO\b|UDEMY|ALURA|HOTMART/i, "Education"],
  [/CLINICA|HOSPITAL|LABORATORIO|ODONTO|DENTIST|\bUNIMED\b/i, "Healthcare"],
  [/INGRESSE|INGRESSO|CINEMA|CINEMARK|SYMPLA|TEATRO/i, "Cinema, theater and concerts"],
  [
    /NETFLIX|SPOTIFY|DISNEY|\bHBO\b|PRIME VIDEO|YOUTUBE|APPLE\.COM|GOOGLE|ANTHROPIC|OPENAI|CHATGPT|CLAUDE|MICROSOFT|ADOBE|NOTION|FIGMA|CANVA|VERCEL|GITHUB|SUPABASE|\bAWS\b|AMAZON WEB|DIGITALOCEAN|CLOUDFLARE|HOSTINGER|GODADDY|\bZOOM\b|\bSLACK\b/i,
    "Digital services",
  ],
  [/ESTACIONAMENTO|\bPARK\b/i, "Parking"],
  [/AUTO ?PECAS|MECANICA|OFICINA|BORRACHARIA|LAVA ?JATO|PNEU/i, "Vehicle maintenance"],
];

// transferências para empresas (e não para pessoas)
const COMPANY =
  /\b(LTDA|S\.? ?A\.?|EIRELI|EPP|SISTEMAS|TECNOLOGIA|SOFTWARE|DESENVOLVIMENTO|PAGAMENTOS|INSTITUICAO|COMERCIO|IMPORTADORA|PRODUTORA|CORRETORA|SOLUCOES|SERVICOS|DIGITAL|AGENCIA|ASSESSORIA|CONSULTORIA)\b/i;

type Raw = { description: string; category?: string | null };

export function recategorize<T extends Raw>(
  txs: T[],
  userRules: CategoryRules
): (T & { category: string | null; originalCategory: string | null })[] {
  // aprendizado: categoria específica mais comum de cada estabelecimento
  const learned = new Map<string, Map<string, number>>();
  for (const t of txs) {
    const cat = t.category ?? null;
    if (!cat || GENERIC.has(cat) || PROTECTED.has(cat)) continue;
    const k = merchantKey(t.description);
    const m = learned.get(k) ?? new Map<string, number>();
    m.set(cat, (m.get(cat) ?? 0) + 1);
    learned.set(k, m);
  }
  const bestLearned = (k: string): string | null => {
    const m = learned.get(k);
    if (!m) return null;
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0][0];
  };

  return txs.map((t) => {
    const original = t.category ?? null;
    const done = (category: string | null) => ({
      ...t,
      category,
      originalCategory: original,
    });
    const key = merchantKey(t.description);

    if (CARD_BILL.test(t.description)) return done("Credit card payment");
    if (userRules[key]) return done(userRules[key]);
    if (original && PROTECTED.has(original)) return done(original);

    for (const [re, cat] of KEYWORD_RULES) {
      if (re.test(key)) return done(cat);
    }

    if (!original || GENERIC.has(original)) {
      const l = bestLearned(key);
      if (l) return done(l);
    }

    if (
      (original === "Transfers" || original === "Transfer - PIX") &&
      COMPANY.test(key)
    ) {
      return done("Supplier payments");
    }

    return done(original);
  });
}
