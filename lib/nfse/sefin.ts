import https from "https";
import type { Ambiente } from "./tipos";
import type { CertificadoA1 } from "./assinatura";

/**
 * Cliente HTTP da API Sefin Nacional (Sistema Nacional NFS-e).
 * Autenticação por mTLS com certificado ICP-Brasil (A1). Sem OAuth, sem token.
 *
 * Endpoints (documentação técnica em gov.br/nfse):
 *   POST /SefinNacional/nfse                       -> emissão (síncrona)
 *   GET  /SefinNacional/nfse/{chaveAcesso}         -> consulta NFS-e
 *   GET  /SefinNacional/dps/{idDps}                -> consulta DPS -> chave
 *   POST /SefinNacional/nfse/{chaveAcesso}/eventos -> cancelamento e demais eventos
 *
 * A API que devolvia o PDF do DANFSe foi desligada em agosto de 2026 (NT SE/CGNFS-e 008/2026).
 * O PDF agora é gerado pelo próprio app, em lib/nfse/danfse.ts.
 */

const BASE_URL: Record<Ambiente, string> = {
  producao: "https://sefin.nfse.gov.br/SefinNacional",
  homologacao: "https://sefin.producaorestrita.nfse.gov.br/SefinNacional",
};

export interface RespostaEmissaoSefin {
  tipoAmbiente: number;
  versaoAplicativo: string;
  dataHoraProcessamento: string;
  idDps: string;
  chaveAcesso: string;
  nfseXmlGZipB64: string;
  alertas?: ErroSefin[];
}

export interface ErroSefin {
  codigo: string;
  descricao: string;
  complemento?: string;
}

export class SefinError extends Error {
  constructor(
    public status: number,
    public erros: ErroSefin[],
  ) {
    super(`Sefin ${status}: ${erros.map((e) => `${e.codigo} ${e.descricao}`).join("; ")}`);
  }
}

interface Opcoes {
  ambiente: Ambiente;
  cert: CertificadoA1;
}

function request<T>(
  { ambiente, cert }: Opcoes,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  raw = false,
): Promise<T> {
  const url = new URL(BASE_URL[ambiente] + path);
  const payload = body ? JSON.stringify(body) : undefined;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        hostname: url.hostname,
        path: url.pathname + url.search,
        pfx: cert.pfx,
        passphrase: cert.senha,
        headers: {
          Accept: raw ? "application/pdf" : "application/json",
          ...(payload
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const status = res.statusCode ?? 0;
          if (status >= 200 && status < 300) {
            if (raw) return resolve(buf as unknown as T);
            try {
              resolve(JSON.parse(buf.toString("utf8")) as T);
            } catch (e) {
              reject(e);
            }
            return;
          }
          let erros: ErroSefin[] = [];
          try {
            const parsed = JSON.parse(buf.toString("utf8"));
            erros = parsed.erros ?? [{ codigo: String(status), descricao: JSON.stringify(parsed) }];
          } catch {
            erros = [{ codigo: String(status), descricao: buf.toString("utf8").slice(0, 500) }];
          }
          reject(new SefinError(status, erros));
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export const sefin = {
  emitir(op: Opcoes, dpsXmlGZipB64: string) {
    return request<RespostaEmissaoSefin>(op, "POST", "/nfse", { dpsXmlGZipB64 });
  },
  consultarNfse(op: Opcoes, chaveAcesso: string) {
    return request<{ nfseXmlGZipB64: string }>(op, "GET", `/nfse/${chaveAcesso}`);
  },
  consultarDps(op: Opcoes, idDps: string) {
    return request<{ chaveAcesso: string }>(op, "GET", `/dps/${idDps}`);
  },
  cancelar(op: Opcoes, chaveAcesso: string, pedidoRegistroEventoXmlGZipB64: string) {
    return request<unknown>(op, "POST", `/nfse/${chaveAcesso}/eventos`, {
      pedidoRegistroEventoXmlGZipB64,
    });
  },

};
