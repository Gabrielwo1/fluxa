/**
 * Consulta do histórico no Emissor Nacional web, com login e senha.
 *
 * É o único caminho para o MEI que não tem certificado digital. O portal mostra todas as
 * NFS-e emitidas e recebidas pelo CNPJ, mas não oferece download em lote: o XML sai uma
 * nota por vez. Então percorremos a listagem e baixamos cada uma.
 *
 * Por ser automação de tela, quebra quando o portal muda. Os seletores abaixo são um ponto
 * de partida e precisam ser validados contra a versão atual do Emissor Nacional.
 */

import { abrirNavegador } from "./navegador";

const URL_LOGIN = "https://www.nfse.gov.br/EmissorNacional/Login";
const URL_CONSULTA = "https://www.nfse.gov.br/EmissorNacional/Notas/Emitidas";

/** Teto de páginas por execução, para a importação não rodar por tempo indefinido. */
const MAX_PAGINAS = 20;

export interface ParametrosPortal {
  login: string;
  senha: string;
}

export interface RespostaPortal {
  xmls: string[];
  aviso?: string;
}

export async function buscarNotasNoPortal(p: ParametrosPortal): Promise<RespostaPortal> {
  const browser = await abrirNavegador();
  const page = await browser.newPage();
  const xmls: string[] = [];
  let aviso: string | undefined;

  try {
    await page.goto(URL_LOGIN, { waitUntil: "networkidle" });
    await page.fill('input[name="Inscricao"]', p.login);
    await page.fill('input[name="Senha"]', p.senha);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/Login")) {
      throw new Error("Login ou senha do Emissor Nacional inválidos");
    }

    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
      await page.goto(`${URL_CONSULTA}?pagina=${pagina}`, { waitUntil: "networkidle" });

      // Cada linha da listagem expõe a chave de acesso da nota.
      const chaves = await page.evaluate(() => {
        const encontradas = new Set<string>();
        for (const el of Array.from(document.querySelectorAll("a, td, span"))) {
          const m = (el.textContent ?? "").match(/\d{50}/);
          if (m) encontradas.add(m[0]);
        }
        return Array.from(encontradas);
      });

      if (chaves.length === 0) break;

      for (const chave of chaves) {
        const resp = await page.request.get(`https://www.nfse.gov.br/EmissorNacional/Notas/Download/XML/${chave}`);
        if (resp.ok()) xmls.push(await resp.text());
      }

      if (pagina === MAX_PAGINAS) {
        aviso = "Trouxemos as primeiras páginas do histórico. Importe de novo para continuar.";
      }
    }

    return { xmls, aviso };
  } finally {
    await browser.close();
  }
}
