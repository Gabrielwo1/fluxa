import type { Browser } from "playwright-core";

/**
 * Abre o navegador usado pela automação do Emissor Nacional.
 *
 * Na Vercel não existe Chrome instalado, então usamos o Chromium do @sparticuz/chromium, que é
 * compilado para rodar em função serverless (Amazon Linux, sem interface gráfica). Na máquina
 * de desenvolvimento usamos o Google Chrome instalado, que é mais rápido de subir.
 *
 * Os dois pacotes são carregados sob demanda para não pesar as rotas que não automatizam o portal.
 */

/** Falha antes de chegar no portal: o problema é do servidor, não da conta do usuário. */
export class NavegadorIndisponivelError extends Error {
  constructor(causa: unknown) {
    super("Não conseguimos abrir o navegador do servidor para acessar o portal. Tente de novo em alguns minutos.");
    this.cause = causa;
  }
}

const emServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export async function abrirNavegador(): Promise<Browser> {
  try {
    const { chromium } = await import("playwright-core");
    if (!emServerless) return await chromium.launch({ headless: true, channel: "chrome" });

    const serverless = (await import("@sparticuz/chromium")).default;
    return await chromium.launch({
      headless: true,
      args: serverless.args,
      executablePath: await serverless.executablePath(),
    });
  } catch (e) {
    // A mensagem para o usuário é genérica; a causa real vai para o log da função.
    console.error("[navegador] falha ao abrir o Chromium:", e);
    throw new NavegadorIndisponivelError(e);
  }
}
