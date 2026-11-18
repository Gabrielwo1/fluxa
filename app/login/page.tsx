import { Suspense } from "react";
import Link from "next/link";
import { Check, Leaf } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { supabaseConfigured } from "@/lib/supabase/config";
import { mvpConfigured } from "@/lib/mvp";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

const PONTOS = [
  "Vendas, estoque e financeiro conectados",
  "Contas a receber e a pagar sem planilha",
  "Notas do MEI e relatórios que explicam o resultado",
];

// Login em duas colunas, no jeito do Radar: marca e promessa de um lado, formulário em vidro do outro.
export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-coal p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full bg-lime/20 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-40 left-10 size-[420px] rounded-full bg-white/10 blur-[120px]" />
        <Link href="/lp" className="relative flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-full bg-lime text-ink">
            <Leaf className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </Link>
        <div className="relative mt-auto max-w-lg">
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight">
            Sua empresa inteira,
            <br />
            <span className="text-lime">num lugar só.</span>
          </h1>
          <ul className="mt-8 flex flex-col gap-3 text-white/75">
            {PONTOS.map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-lime text-ink">
                  <Check className="size-3.5" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <Link href="/lp" className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="grid size-10 place-items-center rounded-full bg-ink text-lime">
            <Leaf className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </Link>

        <div className="glass w-full max-w-md rounded-[28px] p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Entrar no painel</h2>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Acesso exclusivo para clientes e equipe.</p>
          <Suspense fallback={null}>
            <LoginForm supabase={supabaseConfigured} mvp={mvpConfigured()} />
          </Suspense>
        </div>

        <p className="mt-6 max-w-sm text-center text-xs text-ink/45">Seus dados ficam na sua conta e só quem tem o seu acesso consegue ver.</p>
      </section>
    </main>
  );
}
