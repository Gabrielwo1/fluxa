import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/config";
import { MVP_COOKIE, mvpConfigured, readSession } from "@/lib/mvp";

// Rotas públicas: página de anúncios, apresentação, login (e-mail ou código) e o formulário de contato.
const PUBLIC = [
  "/lp",
  "/login",
  "/apresentacao",
  "/api/leads",
  "/api/access/login",
  "/api/access/logout",
];

const isPublic = (path: string) =>
  PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));

// Renova a sessão do Supabase a cada requisição e barra quem não está logado.
// É só a primeira barreira: as rotas da API conferem o cliente de novo.
export async function proxy(request: NextRequest) {
  const mvp = mvpConfigured();
  if (!supabaseConfigured && !mvp) return NextResponse.next();

  let response = NextResponse.next({ request });
  let logged = false;

  if (supabaseConfigured) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });
    // se o Supabase estiver fora do ar, trata como não logado em vez de derrubar a página
    try {
      const { data } = await supabase.auth.getClaims();
      logged = Boolean(data?.claims);
    } catch {
      logged = false;
    }
  }

  if (!logged && mvp) {
    logged = Boolean(await readSession(request.cookies.get(MVP_COOKIE)?.value));
  }

  const path = request.nextUrl.pathname;

  if (!logged && !isPublic(path)) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  if (logged && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
