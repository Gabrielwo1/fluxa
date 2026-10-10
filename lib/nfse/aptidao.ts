import tls from "tls";
import forge from "node-forge";
import type { Ambiente } from "./tipos";
import type { CertificadoA1 } from "./assinatura";

/**
 * Verifica se um certificado A1 está apto a emitir antes de salvar, em vez de o usuário
 * descobrir o problema só na hora da primeira nota.
 *
 * As checagens locais são determinísticas e rápidas. A checagem de conexão tenta o handshake
 * com o ambiente nacional e tem três resultados, porque "o governo recusou" e "não deu para
 * testar agora" pedem ações diferentes do usuário.
 */

// OIDs do padrão ICP-Brasil gravados no subjectAltName (DOC-ICP-04).
const OID_DADOS_PF = "2.16.76.1.3.1"; // nascimento(8) + CPF(11) + ...
const OID_CNPJ = "2.16.76.1.3.3";
const OID_DADOS_RESPONSAVEL = "2.16.76.1.3.4"; // nascimento(8) + CPF(11) + ... do responsável pelo e-CNPJ

export interface Aptidao {
  apto: boolean;
  /** Impedem a emissão. O certificado não deve ser salvo. */
  problemas: string[];
  /** Não impedem, mas o usuário precisa saber. */
  avisos: string[];
  titular: string;
  tipo: "e-CNPJ" | "e-CPF" | "desconhecido";
  cnpj?: string;
  cpf?: string;
  validoAte: string;
  diasRestantes: number;
  conexao?: "aceita" | "recusada" | "nao-testada";
}

function digitos(s: string) {
  return s.replace(/\D/g, "");
}

/** Lê os otherName do subjectAltName, onde a ICP-Brasil grava CNPJ e CPF. */
function lerOtherNames(cert: forge.pki.Certificate): Map<string, string> {
  const out = new Map<string, string>();
  const ext = cert.getExtension("subjectAltName") as { value?: string } | null;
  if (!ext?.value) return out;
  try {
    const nomes = forge.asn1.fromDer(ext.value);
    for (const geral of nomes.value as forge.asn1.Asn1[]) {
      // otherName é o GeneralName de tag de contexto 0, construído.
      if (geral.tagClass !== forge.asn1.Class.CONTEXT_SPECIFIC || geral.type !== 0) continue;
      const [oidNo, explicito] = geral.value as forge.asn1.Asn1[];
      const oid = forge.asn1.derToOid(oidNo.value as string);
      const interno = (explicito.value as forge.asn1.Asn1[])[0];
      const valor = typeof interno.value === "string" ? interno.value : "";
      out.set(oid, valor);
    }
  } catch {
    // extensão malformada: seguimos sem os dados
  }
  return out;
}

function verificacaoLocal(cert: forge.pki.Certificate, cnpjPrestador: string): Aptidao {
  const problemas: string[] = [];
  const avisos: string[] = [];
  const agora = new Date();
  const fim = cert.validity.notAfter;
  const diasRestantes = Math.floor((fim.getTime() - agora.getTime()) / 86_400_000);
  const dataFim = fim.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  if (cert.validity.notBefore > agora) problemas.push("O certificado ainda não entrou em validade.");
  if (fim < agora) problemas.push(`O certificado venceu em ${dataFim}. Renove com a sua certificadora.`);
  else if (diasRestantes <= 30) avisos.push(`O certificado vence em ${diasRestantes} dias, em ${dataFim}. Programe a renovação.`);

  // Heurística: certificados da ICP-Brasil são emitidos por ACs cuja organização é "ICP-Brasil".
  // A validação real da cadeia é feita pelo governo no handshake da conexão.
  const organizacaoEmissor = cert.issuer.getField("O")?.value as string | undefined;
  if (organizacaoEmissor !== "ICP-Brasil") {
    problemas.push("Não é um certificado da ICP-Brasil. O governo só aceita certificados de autoridades credenciadas.");
  }

  const outros = lerOtherNames(cert);
  const nomeComum = String(cert.subject.getField("CN")?.value ?? "");
  const titular = nomeComum.split(":")[0].trim() || "Titular não identificado";

  let tipo: Aptidao["tipo"] = "desconhecido";
  let cnpj: string | undefined;
  let cpf: string | undefined;

  if (outros.has(OID_CNPJ)) {
    tipo = "e-CNPJ";
    cnpj = digitos(outros.get(OID_CNPJ)!).slice(0, 14);
    cpf = digitos(outros.get(OID_DADOS_RESPONSAVEL) ?? "").slice(8, 19) || undefined;
  } else if (outros.has(OID_DADOS_PF)) {
    tipo = "e-CPF";
    cpf = digitos(outros.get(OID_DADOS_PF)!).slice(8, 19) || undefined;
  } else {
    // Sem otherName, tenta o padrão "NOME:documento" do CN.
    const doc = digitos(nomeComum.split(":")[1] ?? "");
    if (doc.length === 14) {
      tipo = "e-CNPJ";
      cnpj = doc;
    } else if (doc.length === 11) {
      tipo = "e-CPF";
      cpf = doc;
    }
  }

  if (tipo === "e-CNPJ" && cnpj) {
    // O ambiente nacional aceita certificado da mesma raiz de CNPJ (os 8 primeiros dígitos).
    if (cnpj.slice(0, 8) !== cnpjPrestador.slice(0, 8)) {
      problemas.push(`Este certificado é do CNPJ ${formatarCnpj(cnpj)}, de outra empresa. Use o certificado do seu CNPJ.`);
    }
  } else if (tipo === "e-CPF") {
    avisos.push(
      "É um certificado de pessoa física. Para emitir em nome do CNPJ o ambiente nacional espera um e-CNPJ, então a emissão pode ser recusada.",
    );
  } else {
    avisos.push("Não conseguimos identificar o CNPJ gravado no certificado. Confira se ele é da sua empresa.");
  }

  const keyUsage = cert.getExtension("keyUsage") as { digitalSignature?: boolean } | null;
  if (keyUsage && keyUsage.digitalSignature === false) {
    problemas.push("O certificado não permite assinatura digital, que é necessária para emitir.");
  }
  const extKeyUsage = cert.getExtension("extKeyUsage") as { clientAuth?: boolean } | null;
  if (extKeyUsage && !extKeyUsage.clientAuth) {
    avisos.push("O certificado não declara uso para autenticação de cliente, e a conexão com o governo pode ser recusada.");
  }

  return {
    apto: problemas.length === 0,
    problemas,
    avisos,
    titular,
    tipo,
    cnpj,
    cpf,
    validoAte: fim.toISOString(),
    diasRestantes,
  };
}

function formatarCnpj(c: string) {
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

const HOST: Record<Ambiente, string> = {
  producao: "sefin.nfse.gov.br",
  homologacao: "sefin.producaorestrita.nfse.gov.br",
};

/**
 * Tenta o handshake TLS mútuo com o ambiente nacional usando o certificado.
 * Handshake completo significa que o governo aceitou o certificado na conexão.
 * Erro de protocolo durante o handshake indica recusa. Rede fora ou tempo esgotado não diz nada.
 */
export function testarConexao(cert: CertificadoA1, ambiente: Ambiente, timeoutMs = 8000): Promise<Aptidao["conexao"]> {
  return new Promise((resolve) => {
    let resolvido = false;
    const fim = (r: Aptidao["conexao"]) => {
      if (resolvido) return;
      resolvido = true;
      sock.destroy();
      resolve(r);
    };
    const sock = tls.connect({
      host: HOST[ambiente],
      port: 443,
      servername: HOST[ambiente],
      pfx: cert.pfx,
      passphrase: cert.senha,
    });
    sock.setTimeout(timeoutMs, () => fim("nao-testada"));
    sock.once("secureConnect", () => fim("aceita"));
    sock.once("error", (e: NodeJS.ErrnoException) => {
      const recusa = /alert|handshake|certificate|EPROTO|ECONNRESET/i.test(`${e.code ?? ""} ${e.message}`);
      // ECONNRESET só conta como recusa se a conexão TCP chegou a abrir.
      fim(recusa && sock.connecting === false ? "recusada" : "nao-testada");
    });
  });
}

export interface OpcoesAptidao {
  cnpjPrestador: string;
  ambiente: Ambiente;
  /** Desligado nos testes e quando não se quer depender da rede. */
  testarConexao?: boolean;
}

export async function verificarAptidao(certificado: CertificadoA1, op: OpcoesAptidao): Promise<Aptidao> {
  const cert = forge.pki.certificateFromPem(certificado.certPem);
  const resultado = verificacaoLocal(cert, op.cnpjPrestador);
  // Só vale gastar a chamada de rede se nada local já impede a emissão.
  if (op.testarConexao && resultado.apto) {
    resultado.conexao = await testarConexao(certificado, op.ambiente);
    if (resultado.conexao === "recusada") {
      resultado.apto = false;
      resultado.problemas.push("O ambiente nacional recusou a conexão com este certificado.");
    }
  } else {
    resultado.conexao = "nao-testada";
  }
  return resultado;
}
