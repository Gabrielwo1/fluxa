import type { RespostaEmissao } from "./tipos";
import type { ContextoEmissao } from "./emissor";
import { abrirNavegador } from "./navegador";

/**
 * Emissão pelo Emissor Nacional web (nfse.gov.br/EmissorNacional) com login e senha.
 *
 * É o caminho que permite ao MEI emitir SEM certificado digital. Não existe API pública
 * para isso: o fluxo abaixo automatiza o portal com Playwright. Por ser automação de tela,
 * ele quebra quando o portal muda e deve ser tratado como módulo experimental.
 *
 * O navegador vem de navegador.ts: Chromium serverless na Vercel, Chrome instalado no desenvolvimento.
 */

const URL_LOGIN = "https://www.nfse.gov.br/EmissorNacional/Login";
const URL_EMISSAO = "https://www.nfse.gov.br/EmissorNacional/DPS/Pessoas";

export interface ParametrosPortal extends ContextoEmissao {
  login: string;
  senha: string;
}

export async function emitirPeloPortal(p: ParametrosPortal): Promise<RespostaEmissao> {
  let browser;
  try {
    browser = await abrirNavegador();
  } catch (e) {
    return { ok: false, modo: "portal", erros: [{ codigo: "PORTAL_INDISPONIVEL", descricao: (e as Error).message }] };
  }
  const page = await browser.newPage();
  try {
    // 1. Login
    await page.goto(URL_LOGIN, { waitUntil: "networkidle" });
    await page.fill('input[name="Inscricao"]', p.login);
    await page.fill('input[name="Senha"]', p.senha);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/Login")) {
      return {
        ok: false,
        modo: "portal",
        erros: [{ codigo: "PORTAL_LOGIN", descricao: "Login ou senha do Emissor Nacional inválidos" }],
      };
    }

    // 2. Nova DPS (o wizard do portal tem várias etapas; os seletores abaixo são um ponto de partida
    //    e precisam ser validados contra a versão atual do portal).
    await page.goto(URL_EMISSAO, { waitUntil: "networkidle" });
    await page.fill('input[name="dCompet"]', p.nota.dataCompetencia.split("-").reverse().join("/"));
    await page.fill('input[name="Tomador.Inscricao"]', p.nota.tomador.documento);
    await page.fill('input[name="Tomador.Nome"]', p.nota.tomador.nome);
    await page.click("text=Avançar");

    await page.fill('input[name="cTribNac"]', p.nota.codigoTributacaoNacional);
    await page.fill('textarea[name="xDescServ"]', p.nota.descricaoServico);
    await page.click("text=Avançar");

    await page.fill('input[name="vServ"]', p.nota.valorServico.toFixed(2).replace(".", ","));
    await page.click("text=Avançar");

    await page.click("text=Emitir NFS-e");
    await page.waitForLoadState("networkidle");

    const chave = (await page.locator("text=/\\d{50}/").first().textContent())?.match(/\d{50}/)?.[0];
    if (!chave) {
      return {
        ok: false,
        modo: "portal",
        erros: [{ codigo: "PORTAL_SEM_CHAVE", descricao: "Não foi possível ler a chave de acesso após emitir" }],
      };
    }
    return {
      ok: true,
      modo: "portal",
      chaveAcesso: chave,
      dataProcessamento: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}
