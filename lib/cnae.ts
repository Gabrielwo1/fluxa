import { servicoPorCodigo, type Servico } from "@/lib/servicos";

/**
 * Correlação entre CNAE e código de tributação nacional (cTribNac).
 *
 * NÃO existe tabela oficial dessa correlação: o CONCLA/IBGE só publica correspondência entre
 * versões da CNAE, e a documentação da NFS-e não liga CNAE à lista de serviço. Esta tabela foi
 * montada a partir das descrições oficiais das duas classificações, com foco nas atividades que
 * o MEI pode exercer. Ela sugere; quem decide é o usuário, e todo código aqui é validado contra a
 * lista oficial pelo teste em scripts/testar-cnae.ts.
 *
 * Chave: prefixo numérico da subclasse CNAE, de 2 a 7 dígitos. Ex.: "9602501" é a subclasse
 * 9602-5/01 e "9602" é a classe. Vence o prefixo mais longo que casar.
 */
const CORRELACAO: Record<string, string[]> = {
  // Agropecuária: só os serviços prestados a terceiros
  "0161001": ["071301"],
  "0161003": ["071601"],
  "0162801": ["050401"],

  // Indústria com componente de serviço
  "1412602": ["140901"],
  "1813001": ["130501"],
  "1822901": ["140801"],
  "3250706": ["041401"],
  "331": ["140101", "140201"],
  "3321": ["140601"],
  "3329501": ["140601"],

  // Resíduos
  "3811": ["070901"],
  "3812": ["070901"],
  "382": ["070902"],
  "3900": ["071201"],

  // Construção
  "41": ["070202", "070201"],
  "42": ["070202", "070201"],
  "43": ["070202", "070201"],
  "4322302": ["140601", "070202"],
  "4329103": ["140601"],
  "4330402": ["070602"],
  "4330403": ["070501"],
  "4330404": ["070501"],
  "4330405": ["070602"],
  "4330499": ["070501"],
  "4391": ["070202", "071701"],

  // Veículos
  "4520001": ["140101"],
  "4520002": ["141201"],
  "4520003": ["140101"],
  "4520004": ["140101"],
  "4520005": ["140501"],
  "4520006": ["140101", "140401"],
  "4520007": ["140601"],
  "4543903": ["140101"],

  // Transporte, logística e entregas
  "4923": ["160201"],
  "4924": ["160201"],
  "4929": ["160201"],
  "4930": ["160201"],
  "5211": ["110401"],
  "5212": ["110402"],
  "5222": ["200301"],
  "5229002": ["141401"],
  "5231102": ["200101"],
  "5240101": ["200201"],
  "5250803": ["100202"],
  "5320": ["260101", "260102"],

  // Alojamento e eventos com alimentação
  "5510": ["090101"],
  "5590": ["090102"],
  "5620102": ["171102"],

  // Audiovisual e música
  "5911": ["130301", "121301"],
  "5912": ["130301"],
  "5913": ["121601"],
  "5914": ["121601"],
  "5920": ["130201"],

  // Tecnologia da informação
  // Criar site para cliente é desenvolvimento sob encomenda, mas na lista nacional tem código próprio.
  "6201": ["010101", "010401", "010201", "010801"],
  "6202": ["010401", "010501"],
  "6203": ["010501"],
  "6204": ["010601"],
  "6209": ["010701"],
  "6311": ["010301", "010302"],
  "6319": ["010801", "010902"],
  "6391": ["100701"],
  "6399": ["170102"],

  // Financeiro e seguros
  "6612605": ["100201"],
  "6622": ["100102"],

  // Imobiliário
  "6821": ["100501"],
  "6822": ["171201"],

  // Profissionais, científicos e técnicos
  "6911": ["171401"],
  "6920": ["171901", "171601"],
  "7020": ["170101", "170303", "172001"],
  "7111": ["070104", "070302"],
  "7112": ["070101", "070302", "071901"],
  "7119701": ["072001"],
  "7119702": ["072002", "072003"],
  "7119703": ["320101"],
  "7119799": ["070101"],
  "7120": ["170901"],
  "72": ["020101"],
  "7311": ["170601"],
  "7312": ["100801"],
  "7319": ["170601", "172501"],
  "7320": ["170102"],
  "7410202": ["071101"],
  "7410203": ["230102"],
  "7410299": ["230101", "010801"],
  "7420001": ["130301"],
  "7420002": ["072001"],
  "7420003": ["130301"],
  "7420004": ["130301"],
  "7490101": ["170205"],
  "7490102": ["072101"],
  "7490103": ["070102"],
  "7490104": ["100202"],
  "7490105": ["100202"],
  "7490199": ["170101"],
  "7500": ["050101", "050202"],

  // Serviços administrativos e de apoio
  "7739003": ["030501"],
  "7810": ["170401"],
  "7820": ["170501"],
  "7830": ["170501"],
  "7911": ["090201"],
  "7912": ["090202"],
  "7990": ["090201"],
  "8011": ["110201"],
  "8012": ["110301"],
  "8020001": ["110501"],
  "8020002": ["110201"],
  "8030": ["340101"],
  "8111": ["071002"],
  "8112": ["171201"],
  "8121": ["071002"],
  "8122": ["071301"],
  "8129": ["071002"],
  "8130": ["071102", "070106"],
  "8211": ["170202"],
  "8219901": ["130401"],
  "8219999": ["170201", "170202"],
  "8220": ["170203"],
  "8230001": ["171001", "171002"],
  "8230002": ["030301"],
  "8291": ["172201"],
  "8299": ["170202"],

  // Educação
  "851": ["080101"],
  "852": ["080101"],
  "853": ["080102"],
  "854": ["080201"],
  "855": ["080201"],
  "859": ["080201"],

  // Saúde e assistência
  "8630504": ["041201"],
  "863": ["040101"],
  "8640202": ["040201"],
  "864": ["040205"],
  "8650001": ["040601"],
  "8650002": ["041001"],
  "8650003": ["041601"],
  "8650004": ["040802"],
  "8650005": ["040801"],
  "8650006": ["040803"],
  "8650007": ["041001"],
  "8650099": ["040901"],
  "8690901": ["040901"],
  "8690": ["040901"],
  "871": ["041701"],
  "872": ["041702"],
  "873": ["041704"],
  "8800": ["270101"],

  // Artes, cultura, esporte e recreação
  "9001901": ["120101"],
  "9001902": ["121201", "121301"],
  "9001903": ["120701"],
  "9001904": ["120301"],
  "9001906": ["121301"],
  "9001999": ["120701"],
  "9002701": ["400101", "170204"],
  "9311": ["060401"],
  "9312": ["060401"],
  "9313": ["060401"],
  "9319101": ["121101"],
  "9321": ["120501"],
  "9329801": ["120601"],
  "9329803": ["120901"],
  "9329899": ["121701"],

  // Reparação de objetos pessoais e domésticos
  "9511": ["140201", "010701"],
  "9512": ["140201"],
  "9521": ["140201"],
  "9529101": ["140101"],
  "9529102": ["240101"],
  "9529103": ["140101"],
  "9529104": ["140101"],
  "9529105": ["141101"],
  "9529106": ["390101"],
  "9529199": ["140101", "140901"],

  // Serviços pessoais
  "9601": ["141001"],
  "9602501": ["060101"],
  "9602502": ["060201"],
  "9603": ["250101"],
  "9609205": ["060301"],
  "9609206": ["060601"],
  "9609208": ["050801"],
};

export interface Cnae {
  /** 7 dígitos, sem pontuação. Ex.: 9602501. */
  codigo: string;
  descricao: string;
}

export function formatarCnae(codigo: string): string {
  const d = codigo.replace(/\D/g, "").padStart(7, "0");
  return `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}`;
}

/** Códigos sugeridos para uma subclasse, pelo prefixo mais específico da tabela. */
export function codigosDoCnae(cnae: string): string[] {
  const d = cnae.replace(/\D/g, "").padStart(7, "0");
  for (let tamanho = 7; tamanho >= 2; tamanho--) {
    const hit = CORRELACAO[d.slice(0, tamanho)];
    if (hit) return hit;
  }
  return [];
}

export interface SugestaoServico extends Servico {
  /** CNAE da empresa que originou a sugestão. */
  cnae: string;
  principal: boolean;
}

/**
 * Serviços compatíveis com as atividades registradas da empresa, na ordem em que fazem mais sentido:
 * primeiro os da atividade principal, depois os das secundárias, sem repetir código.
 */
export function servicosCompativeis(cnaes: Cnae[]): SugestaoServico[] {
  const vistos = new Set<string>();
  const out: SugestaoServico[] = [];
  cnaes.forEach((c, i) => {
    for (const codigo of codigosDoCnae(c.codigo)) {
      if (vistos.has(codigo)) continue;
      const s = servicoPorCodigo(codigo);
      if (!s) continue;
      vistos.add(codigo);
      out.push({ ...s, cnae: c.codigo, principal: i === 0 });
    }
  });
  return out;
}

/** O código escolhido corresponde a alguma atividade da empresa? null quando não há CNAE para comparar. */
export function codigoCompativel(codigo: string, cnaes: Cnae[] | undefined): boolean | null {
  if (!cnaes?.length) return null;
  const sugeridos = servicosCompativeis(cnaes);
  if (sugeridos.length === 0) return null;
  return sugeridos.some((s) => s.codigo === codigo);
}

/** Exposto só para o teste validar a tabela contra a lista oficial. */
export const _CORRELACAO = CORRELACAO;
