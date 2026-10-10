import type { NextConfig } from "next";

/**
 * Arquivos que as rotas fiscais leem por caminho em tempo de execução, e que o rastreador de
 * dependências não enxerga: o playwright-core carrega o browsers.json e partes do próprio
 * pacote dinamicamente, e o Chromium serverless descompacta os binários da pasta bin/. Sem
 * isso, a automação do Emissor Nacional sobe na Vercel sem eles e falha antes de abrir o site.
 */
const arquivosDoNavegador = [
  "./node_modules/playwright-core/**/*",
  "./node_modules/@sparticuz/chromium/bin/**/*",
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/nfse/importar": arquivosDoNavegador,
    "/api/nfse/emitir": arquivosDoNavegador,
  },
};

export default nextConfig;
