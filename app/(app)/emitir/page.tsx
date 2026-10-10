"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Download, FileText, Loader2, Mic, Send, Sparkles } from "lucide-react";
import { PageTitle, Panel, PanelHeader } from "@/components/ui-kit";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { carregarEmitente, fmtDoc, type Emitente } from "@/lib/nfse-client";
import { servicoPorCodigo } from "@/lib/servicos";
import { codigoCompativel, servicosCompativeis } from "@/lib/cnae";
import type { MensagemChat } from "@/lib/ai/agente";
import type { RascunhoNota, ResultadoEmissao } from "@/lib/nfse/tipos";

/**
 * Emissão por conversa: a pessoa descreve o serviço, a IA monta o rascunho e só o botão
 * emite. A IA nunca emite sozinha — quem confirma é quem assina a nota.
 */

type MsgTela = { id: string; papel: "user" | "assistant"; texto: string };

function Emitir() {
  const [emitente, setEmitente] = useState<Emitente | null | undefined>(undefined);
  const [tela, setTela] = useState<MsgTela[]>([
    {
      id: "boas-vindas",
      papel: "assistant",
      texto: "Me diga para quem foi o serviço, quanto você cobrou e o que fez. Pode falar no microfone.",
    },
  ]);
  const [historico, setHistorico] = useState<MensagemChat[]>([]);
  // Veio de uma transação do Open Finance: a frase já chega escrita, é só conferir e enviar.
  const [entrada, setEntrada] = useState(useSearchParams().get("texto") ?? "");
  const [pensando, setPensando] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoNota | null>(null);
  const [emitindo, setEmitindo] = useState(false);
  const [erroEmissao, setErroEmissao] = useState("");
  const [resultado, setResultado] = useState<(ResultadoEmissao & { id: string; numeroDps: number }) | null>(null);
  const [ouvindo, setOuvindo] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    carregarEmitente().then(setEmitente);
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tela, rascunho, resultado]);

  async function enviar(texto: string) {
    const t = texto.trim();
    if (!t || pensando) return;
    setEntrada("");
    setResultado(null);
    setErroEmissao("");
    setTela((m) => [...m, { id: crypto.randomUUID(), papel: "user", texto: t }]);
    setPensando(true);
    const msgs: MensagemChat[] = [...historico, { role: "user", content: t }];
    try {
      const r = await fetch("/api/nfse/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Falha ao falar com a IA");
      setHistorico(j.messages);
      setTela((m) => [...m, { id: crypto.randomUUID(), papel: "assistant", texto: j.texto || "…" }]);
      if (j.rascunho) setRascunho(j.rascunho);
    } catch (e) {
      setTela((m) => [...m, { id: crypto.randomUUID(), papel: "assistant", texto: `Erro: ${(e as Error).message}` }]);
    } finally {
      setPensando(false);
    }
  }

  async function emitir() {
    if (!rascunho) return;
    setEmitindo(true);
    setErroEmissao("");
    try {
      const r = await fetch("/api/nfse/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota: rascunho }),
      });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(
          j.erros ? j.erros.map((e: { codigo: string; descricao: string }) => `${e.codigo}: ${e.descricao}`).join("\n") : j.error
        );
      }
      setResultado(j);
      setRascunho(null);
      setHistorico([]);
      setTela((m) => [...m, { id: crypto.randomUUID(), papel: "assistant", texto: "Pronto. Quer emitir outra?" }]);
    } catch (e) {
      setErroEmissao((e as Error).message);
    } finally {
      setEmitindo(false);
    }
  }

  function alternarVoz() {
    if (ouvindo) {
      recRef.current?.stop();
      setOuvindo(false);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return alert("Seu navegador não suporta ditado por voz. Use o Chrome ou digite.");
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    let final = "";
    rec.onresult = (ev) => {
      let parcial = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) final += r[0].transcript;
        else parcial += r[0].transcript;
      }
      setEntrada(final + parcial);
    };
    rec.onend = () => {
      setOuvindo(false);
      if (final.trim()) enviar(final);
    };
    rec.onerror = () => setOuvindo(false);
    recRef.current = rec;
    rec.start();
    setOuvindo(true);
  }

  if (emitente === undefined) return null;

  if (!emitente) {
    return (
      <>
        <PageTitle title="Emitir nota" />
        <Panel className="text-center">
          <Sparkles className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Falta dizer quem emite</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Cadastre o CNPJ deste cliente para o assistente saber quais serviços ele presta e qual código usar.
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
        title="Emitir nota"
        subtitle={`${emitente.razaoSocial} · ${emitente.modoEmissao === "simulacao" ? "em simulação" : "conectado ao governo"}`}
        right={
          <Link href="/notas" className={buttonVariants({ variant: "outline" })}>
            <FileText /> Ver notas
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Panel className="flex min-h-[60vh] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto">
            {tela.map((m) => (
              <div key={m.id} className={`flex ${m.papel === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.papel === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {m.texto}
                </div>
              </div>
            ))}
            {pensando && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Pensando…
              </p>
            )}
            <div ref={fimRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(entrada);
            }}
            className="mt-4 flex items-end gap-2 border-t pt-4"
          >
            <Button type="button" variant={ouvindo ? "destructive" : "outline"} size="icon" onClick={alternarVoz} aria-label="Ditar por voz">
              <Mic />
            </Button>
            <textarea
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar(entrada);
                }
              }}
              rows={1}
              placeholder={ouvindo ? "Ouvindo…" : "Descreva o serviço prestado…"}
              className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
            />
            <Button type="submit" size="icon" disabled={pensando || !entrada.trim()} aria-label="Enviar">
              <Send />
            </Button>
          </form>
        </Panel>

        <div className="space-y-4">
          {rascunho && (
            <CartaoRascunho
              rascunho={rascunho}
              cnaes={emitente.cnaes}
              emitindo={emitindo}
              erro={erroEmissao}
              onEmitir={emitir}
              onCancelar={() => setRascunho(null)}
              onTrocarCodigo={(codigo) => setRascunho({ ...rascunho, codigoTributacaoNacional: codigo })}
            />
          )}
          {resultado && <CartaoResultado r={resultado} />}
          {!rascunho && !resultado && (
            <Panel>
              <PanelHeader title="Como funciona" />
              <ol className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <li>1. Você descreve o serviço em uma frase.</li>
                <li>2. A IA consulta o CNPJ do cliente na Receita e escolhe o código de serviço.</li>
                <li>3. O rascunho aparece aqui para você conferir.</li>
                <li>4. A nota só é emitida quando você aperta o botão.</li>
              </ol>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function CartaoRascunho({
  rascunho,
  cnaes,
  emitindo,
  erro,
  onEmitir,
  onCancelar,
  onTrocarCodigo,
}: {
  rascunho: RascunhoNota;
  cnaes?: { codigo: string; descricao: string }[];
  emitindo: boolean;
  erro: string;
  onEmitir: () => void;
  onCancelar: () => void;
  onTrocarCodigo: (codigo: string) => void;
}) {
  const servico = servicoPorCodigo(rascunho.codigoTributacaoNacional);
  const compativel = codigoCompativel(rascunho.codigoTributacaoNacional, cnaes);
  const opcoes = servicosCompativeis(cnaes ?? []);

  return (
    <Panel>
      <PanelHeader title="Confira antes de emitir" />
      <dl className="divide-y text-sm">
        <div className="flex justify-between gap-3 py-2.5">
          <dt className="text-muted-foreground">Cliente</dt>
          <dd className="text-right">
            <span className="font-medium">{rascunho.tomador.nome}</span>
            <span className="block text-xs text-muted-foreground tabular-nums">{fmtDoc(rascunho.tomador.documento)}</span>
          </dd>
        </div>
        <div className="flex justify-between gap-3 py-2.5">
          <dt className="shrink-0 text-muted-foreground">Serviço</dt>
          <dd className="text-right">
            <span className="font-medium">{rascunho.descricaoServico}</span>
            <span className="block text-xs text-muted-foreground">
              {servico ? `${servico.item} · ${servico.descricao}` : rascunho.codigoTributacaoNacional}
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-3 py-2.5">
          <dt className="text-muted-foreground">Competência</dt>
          <dd className="font-medium">{rascunho.dataCompetencia.split("-").reverse().join("/")}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-muted-foreground">Valor</dt>
          <dd className="text-lg font-semibold tabular-nums">{brl.format(rascunho.valorServico)}</dd>
        </div>
      </dl>

      {compativel === false && (
        <div className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
          Esse serviço não aparece entre as atividades do CNPJ. O MEI só pode emitir nota das atividades
          registradas — confira o código antes de emitir.
        </div>
      )}
      {compativel !== null && opcoes.length > 0 && (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs text-muted-foreground">Código de serviço</span>
          <select
            value={opcoes.some((o) => o.codigo === rascunho.codigoTributacaoNacional) ? rascunho.codigoTributacaoNacional : ""}
            onChange={(e) => e.target.value && onTrocarCodigo(e.target.value)}
            className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
          >
            {!compativel && <option value="">Escolha um código das suas atividades</option>}
            {opcoes.map((o) => (
              <option key={o.codigo} value={o.codigo}>
                {o.item} · {o.descricao.slice(0, 60)}
                {o.descricao.length > 60 ? "…" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      {erro && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{erro}</pre>}

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={onEmitir} disabled={emitindo}>
          {emitindo ? <Loader2 className="animate-spin" /> : null}
          {emitindo ? "Emitindo…" : "Emitir nota"}
        </Button>
        <Button variant="outline" onClick={onCancelar} disabled={emitindo}>
          Corrigir
        </Button>
      </div>
    </Panel>
  );
}

function CartaoResultado({ r }: { r: ResultadoEmissao & { id: string; numeroDps: number } }) {
  return (
    <Panel>
      <PanelHeader
        title={r.modo === "simulacao" ? "Simulação concluída" : "NFS-e emitida"}
        right={<Badge variant={r.modo === "simulacao" ? "outline" : "default"}>DPS #{r.numeroDps}</Badge>}
      />
      <p className="font-mono text-[11px] break-all text-muted-foreground">{r.chaveAcesso}</p>
      {r.modo === "simulacao" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Nada foi enviado ao governo. Conecte a conta em Configuração fiscal para emitir de verdade.
        </p>
      )}
      <a
        href={`/api/nfse/notas/${r.id}/danfse`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonVariants({ variant: "outline" })} mt-4 w-full`}
      >
        <Download /> {r.modo === "simulacao" ? "Ver PDF" : "Baixar PDF"}
      </a>
    </Panel>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult:
    | ((ev: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

export default function EmitirPage() {
  return (
    <Suspense fallback={null}>
      <Emitir />
    </Suspense>
  );
}
