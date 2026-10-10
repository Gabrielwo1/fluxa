/** Consulta pública de CNPJ via BrasilAPI (sem chave). */

export interface DadosCnpj {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  email?: string;
  telefone?: string;
  opcaoMei: boolean;
  opcaoSimples: boolean;
  /** Atividade principal primeiro, depois as secundárias. */
  cnaes: { codigo: string; descricao: string }[];
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    municipio: string;
    uf: string;
    codigoMunicipio: string;
    cep: string;
  };
}

export async function consultarCnpj(cnpjBruto: string): Promise<DadosCnpj> {
  const cnpj = cnpjBruto.replace(/\D/g, "");
  if (cnpj.length !== 14) throw new Error("CNPJ deve ter 14 dígitos");

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; MeiNotaIA/0.1)" },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (res.status === 404) throw new Error("CNPJ não encontrado na Receita Federal");
  if (!res.ok) throw new Error(`Falha ao consultar CNPJ (${res.status})`);
  const d = await res.json();

  return {
    cnpj,
    razaoSocial: d.razao_social,
    nomeFantasia: d.nome_fantasia || undefined,
    email: d.email || undefined,
    telefone: d.ddd_telefone_1 || undefined,
    opcaoMei: Boolean(d.opcao_pelo_mei),
    opcaoSimples: Boolean(d.opcao_pelo_simples),
    cnaes: [
      { codigo: d.cnae_fiscal, descricao: d.cnae_fiscal_descricao },
      ...((d.cnaes_secundarios as { codigo: number; descricao: string }[] | undefined) ?? []),
    ]
      // A BrasilAPI devolve {codigo: 0} quando não há atividade secundária.
      .filter((c) => c && Number(c.codigo) > 0)
      .map((c) => ({ codigo: String(c.codigo).padStart(7, "0"), descricao: String(c.descricao ?? "") })),
    endereco: {
      logradouro: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" "),
      numero: d.numero || "S/N",
      complemento: d.complemento || undefined,
      bairro: d.bairro,
      municipio: d.municipio,
      uf: d.uf,
      codigoMunicipio: String(d.codigo_municipio_ibge),
      cep: String(d.cep).replace(/\D/g, ""),
    },
  };
}
