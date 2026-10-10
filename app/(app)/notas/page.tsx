"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Download, Plus, Search, Sparkles } from "lucide-react";
import { PageTitle, Panel, PanelHeader } from "@/components/ui-kit";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import {
  cancelarNota,
  carregarEmitente,
  carregarResumo,
  fmtDoc,
  listarNotas,
  registrarNotaManual,
  type Emitente,
} from "@/lib/nfse-client";
import type { NotaDb } from "@/lib/nfse-store";
import type { Resumo } from "@/lib/financeiro";
import type { StatusNota } from "@/lib/financeiro";

/** Notas fiscais do cliente: o que já saiu, o quanto falta para o teto e o registro manual. */

const SELO: Record<StatusNota, { texto: string; variante: "default" | "secondary" | "outline" | "destructive" }> = {
  emitida: { texto: "Emitida", variante: "default" },
  simulada: { texto: "Simulação", variante: "outline" },
  registrada: { texto: "Registrada", variante: "secondary" },
  processando: { texto: "Processando", variante: "outline" },
  erro: { texto: "Erro", variante: "destructive" },
  cancelada: { texto: "Cancelada", variante: "destructive" },
};

export default function NotasPage() {
  const [emitente, setEmitente] = useState<Emitente | null | undefined>(undefined);
  const [notas, setNotas] = useState<NotaDb[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [busca, setBusca] = useState("");
  const [registrando, setRegistrando] = useState(false);

  const recarregar = useCallback(async (termo?: string) => {
    const [lista, r] = await Promise.all([listarNotas(termo), carregarResumo()]);
    setNotas(lista);
    setResumo(r);
  }, []);

  useEffect(() => {
    carregarEmitente().then(async (e) => {
      setEmitente(e);
      if (e) await recarregar();
    });
  }, [recarregar]);

  if (emitente === undefined) return null;

  if (!emitente) {
    return (
      <>
        <PageTitle title="Notas fiscais" />
        <Panel className="text-center">
          <Sparkles className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nenhum emitente configurado</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Cadastre o CNPJ deste cliente para emitir NFS-e e acompanhar o faturamento por aqui.
          </p>
          <Link href="/fiscal" className={`${buttonVariants()} mt-4`}>
            Configuração fiscal
          </Link>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="Notas fiscais"
        subtitle={emitente.razaoSocial}
        right={
          <div className="flex gap-2">
            <Link href="/fiscal" className={buttonVariants({ variant: "outline" })}>
              Configuração fiscal
            </Link>
            <Link href="/emitir" className={buttonVariants()}>
              <Sparkles /> Emitir nota
            </Link>
          </div>
        }
      />

      {resumo && <ResumoCards resumo={resumo} />}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        <Panel>
          <PanelHeader
            title="Emitidas"
            right={
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    recarregar(e.target.value);
                  }}
                  placeholder="Buscar cliente ou serviço"
                  className="h-8 w-56 pl-8 text-xs"
                />
              </div>
            }
          />
          {notas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma nota ainda. As que você emitir aparecem aqui.
            </p>
          ) : (
            <div className="divide-y">
              {notas.map((n) => (
                <LinhaNota key={n.id} nota={n} onCancelar={() => cancelarNota(n.id).then(() => recarregar(busca))} />
              ))}
            </div>
          )}
        </Panel>

        <RegistroManual
          ocupado={registrando}
          onRegistrar={async (dados) => {
            setRegistrando(true);
            try {
              await registrarNotaManual(dados);
              await recarregar(busca);
            } finally {
              setRegistrando(false);
            }
          }}
        />
      </div>
    </>
  );
}

function ResumoCards({ resumo }: { resumo: Resumo }) {
  const pct = Math.min(100, Math.round(resumo.percentualLimite));
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Panel>
        <p className="text-xs text-muted-foreground">Faturado no ano</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{brl.format(resumo.anoAtual)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {resumo.totalNotas} {resumo.totalNotas === 1 ? "nota" : "notas"}
          {resumo.pendentes > 0 ? ` · ${resumo.pendentes} em emissão` : ""}
        </p>
      </Panel>
      <Panel>
        <p className="text-xs text-muted-foreground">Média por mês</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{brl.format(resumo.mediaMensal)}</p>
        <p className="mt-1 text-xs text-muted-foreground">mês atual: {brl.format(resumo.mesAtual)}</p>
      </Panel>
      <Panel>
        <p className="text-xs text-muted-foreground">Limite anual</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{pct}%</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${pct >= 90 ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {brl.format(resumo.anoAtual)} de {brl.format(resumo.limiteAnual)}
        </p>
      </Panel>
    </div>
  );
}

function LinhaNota({ nota, onCancelar }: { nota: NotaDb; onCancelar: () => void }) {
  const selo = SELO[nota.status];
  const temPdf = Boolean(nota.chaveAcesso) && nota.status !== "erro" && nota.status !== "processando";
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{nota.tomadorNome}</p>
        <p className="truncate text-xs text-muted-foreground">{nota.descricao}</p>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {fmtDoc(nota.tomadorDocumento)} · {nota.competencia.split("-").reverse().join("/")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">{brl.format(nota.valor)}</p>
          <Badge variant={selo.variante}>{selo.texto}</Badge>
        </div>
        {temPdf && (
          <a
            href={`/api/nfse/notas/${nota.id}/danfse`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            aria-label="Abrir PDF"
          >
            <Download />
          </a>
        )}
        {nota.status !== "cancelada" && (
          <Button variant="ghost" size="icon" onClick={onCancelar} aria-label="Marcar como cancelada">
            <Ban />
          </Button>
        )}
      </div>
    </div>
  );
}

function RegistroManual({
  ocupado,
  onRegistrar,
}: {
  ocupado: boolean;
  onRegistrar: (d: {
    valor: number;
    competencia: string;
    tomadorNome: string;
    tomadorDocumento: string;
    descricao: string;
  }) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [doc, setDoc] = useState("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState("");

  const documento = doc.replace(/\D/g, "");
  const numero = parseFloat(valor.replace(/\./g, "").replace(",", "."));
  const pode = nome.trim() && (documento.length === 11 || documento.length === 14) && numero > 0 && descricao.trim();

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    try {
      await onRegistrar({
        valor: numero,
        competencia,
        tomadorNome: nome.trim(),
        tomadorDocumento: documento,
        descricao: descricao.trim(),
      });
      setNome("");
      setDoc("");
      setValor("");
      setDescricao("");
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Registrar nota de fora"
        subtitle="Emitida no portal ou pelo contador? Registre para o faturamento e o limite ficarem certos."
      />
      <form onSubmit={enviar} className="space-y-3">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" />
        <Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="CPF ou CNPJ" inputMode="numeric" />
        <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que foi feito" />
        <div className="flex gap-2">
          <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor" inputMode="decimal" />
          <Input type="date" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
        </div>
        {erro && <p className="text-xs text-destructive">{erro}</p>}
        <Button type="submit" className="w-full" disabled={!pode || ocupado}>
          <Plus /> {ocupado ? "Registrando…" : "Registrar"}
        </Button>
      </form>
    </Panel>
  );
}
