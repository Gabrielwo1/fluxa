import Link from "next/link";
import { BrandMark } from "@/components/site/site-header";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-8 text-center shadow-sm">
        <BrandMark className="mb-6 justify-center" />
        <h1 className="text-2xl font-semibold tracking-tight">Página não encontrada</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          Esse endereço não existe. O seu painel continua no início.
        </p>
        <Link
          href="/"
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
        >
          Ir para o painel
        </Link>
      </div>
    </main>
  );
}
