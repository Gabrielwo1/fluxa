// Ambiente de demonstração: cada visitante ganha uma empresa fictícia própria ("demo-xxxxxxxx").
export const DEMO_PREFIX = "demo-";
export const DEMO_TEMPLATE = "demo-template";
export const isDemoSlug = (slug: string) => slug.startsWith(DEMO_PREFIX);
export const DEMO_HOURS = 24;
