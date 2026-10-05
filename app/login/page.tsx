import { Suspense } from "react";
import { BrandMark } from "@/components/site/site-header";
import { supabaseConfigured } from "@/lib/supabase/config";
import { mvpConfigured } from "@/lib/mvp";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-8 shadow-sm">
        <BrandMark className="mb-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Entrar no painel</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          Acesso exclusivo para clientes e equipe.
        </p>
        <Suspense fallback={null}>
          <LoginForm supabase={supabaseConfigured} mvp={mvpConfigured()} />
        </Suspense>
      </div>
    </main>
  );
}
