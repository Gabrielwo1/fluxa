import LISTA from "@/lib/data/servicos-nacionais.json";

/**
 * Lista de Serviço Nacional: os 338 códigos de tributação nacional (cTribNac) da NFS-e.
 * Fonte: Anexo B da documentação técnica do Sistema Nacional NFS-e. Regenerar com
 * `npx tsx scripts/gerar-dados.ts`. Nunca escreva códigos à mão: é assim que se erra o código.
 */

export interface Servico {
  /** 6 dígitos: item, subitem e desdobro nacional. Ex.: 170601. */
  codigo: string;
  /** Item da LC 116. Ex.: 17.06. */
  item: string;
  descricao: string;
}

export const SERVICOS: Servico[] = LISTA;

const POR_CODIGO = new Map(SERVICOS.map((s) => [s.codigo, s]));

export function servicoPorCodigo(codigo: string): Servico | undefined {
  return POR_CODIGO.get(codigo);
}

/**
 * Palavras que o usuário usa e que não aparecem na descrição oficial.
 * Só ajuda a busca: o código e a descrição continuam vindo da lista oficial.
 */
const APELIDOS: Record<string, string> = {
  "010101": "software sistema desenvolvedor dev app aplicativo",
  "010201": "programador codigo dev",
  "010302": "hospedagem hosting servidor cloud nuvem",
  "010401": "app aplicativo jogo game software",
  "010501": "licenca saas assinatura software",
  "010601": "consultoria ti tecnologia",
  "010701": "suporte ti informatica computador notebook formatacao manutencao rede redes roteador wifi cabeamento internet ssd",
  "010801": "site website landing page pagina loja virtual wordpress",
  "010902": "streaming conteudo digital curso online",
  "040101": "medico consulta",
  "040802": "fisioterapeuta fisio",
  "040803": "fono fonoaudiologo",
  "041001": "nutricionista dieta",
  "041201": "dentista odonto",
  "041601": "psicologo terapia sessao",
  "050101": "veterinario vet",
  "050801": "banho tosa pet shop adestramento hotel pet",
  "060101": "cabelo cabeleireiro barbeiro barbearia manicure pedicure unha salao",
  "060201": "estetica esteticista depilacao sobrancelha cilios limpeza de pele maquiagem",
  "060301": "massagem massoterapia",
  "060401": "personal trainer treino academia yoga pilates danca luta",
  "060601": "tatuagem tattoo piercing",
  "070101": "engenheiro engenharia",
  "070104": "arquiteto arquitetura projeto",
  "070202": "obra pedreiro construcao reforma eletricista encanador hidraulica eletrica",
  "070501": "reforma reparo pintura pintor gesso conserto predial",
  "070602": "instalacao piso revestimento vidro divisoria porta janela",
  "071002": "limpeza faxina diarista higienizacao piscina",
  "071101": "decoracao decorador festa",
  "071102": "jardinagem jardineiro poda",
  "071301": "dedetizacao desratizacao pragas",
  "080201": "aula curso treinamento professor mentoria reforco idiomas ingles",
  "090201": "agencia de viagem turismo",
  "100202": "intermediacao comissao agenciamento",
  "100501": "corretor imoveis imobiliaria",
  "100901": "representante comercial vendas comissao",
  "110201": "seguranca vigilante vigia portaria",
  "110402": "carga descarga mudanca",
  "120701": "show musica banda cantor dj danca",
  "121201": "musico musica ao vivo",
  "121301": "producao de eventos evento produtora",
  "121701": "recreacao animador festa infantil",
  "130201": "gravacao audio podcast mixagem",
  "130301": "foto fotografia fotografo video filmagem videomaker edicao de video",
  "130401": "copia xerox impressao digitalizacao",
  "140101": "mecanico conserto manutencao revisao",
  "140201": "assistencia tecnica conserto celular eletronico",
  "140501": "lavagem lava jato polimento estetica automotiva",
  "140601": "instalacao montagem ar condicionado moveis montador",
  "140901": "costura costureira ajuste roupa alfaiate",
  "141001": "lavanderia",
  "141301": "marceneiro carpinteiro moveis planejados",
  "141302": "serralheiro serralheria portao",
  "160201": "transporte frete motorista uber",
  "170101": "consultoria consultor assessoria",
  "170202": "secretaria administrativo apoio",
  "170204": "redacao revisao texto copywriting copy editor",
  "170205": "traducao tradutor interprete",
  "170601": "marketing publicidade trafego pago anuncios social media gestao de redes instagram",
  "171101": "festa recepcao cerimonial",
  "171102": "buffet bufe",
  "171201": "administracao gestao",
  "171901": "contabilidade contador",
  "172001": "financeiro financas planejamento financeiro",
  "172401": "palestra palestrante workshop",
  "230101": "design designer logo identidade visual arte grafica",
  "230102": "design de produto desenho industrial",
  "240101": "chaveiro carimbo",
  "240102": "placa banner adesivo letreiro comunicacao visual",
  "260101": "entrega motoboy delivery courier",
  "310102": "tecnico eletronica eletrica",
  "320101": "desenho tecnico projetista",
  "350101": "jornalista reportagem",
  "350102": "assessoria de imprensa",
  "370101": "modelo artista atleta influencer ator",
  "400101": "obra de arte artista plastico quadro",
};

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const INDICE = SERVICOS.map((s) => ({ s, alvo: normalizar(`${s.descricao} ${APELIDOS[s.codigo] ?? ""}`) }));

/**
 * Busca por palavras-chave. Quando `preferidos` é informado (os códigos compatíveis com o CNAE
 * da empresa), eles sobem na ordenação: um MEI de beleza que digita "limpeza" quer limpeza de
 * pele, não limpeza de imóveis.
 */
export function buscarServicos(consulta: string, limite = 5, preferidos: string[] = []): Servico[] {
  const termos = normalizar(consulta)
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const bonus = new Set(preferidos);
  return INDICE.map(({ s, alvo }) => {
    const acertos = termos.reduce((acc, t) => acc + (alvo.includes(t) ? 1 : 0), 0);
    return { s, pontos: acertos === 0 ? 0 : acertos + (bonus.has(s.codigo) ? 2 : 0) };
  })
    .filter((p) => p.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, limite)
    .map((p) => p.s);
}
