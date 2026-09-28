"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { marcarPesquisaExibida, marcarPesquisaIniciada, responderPesquisa, type PesquisaParaResponder } from "@/actions/pesquisas";
import { normalizarResposta, LIMITE_DO_TEXTO, type Resposta } from "@/lib/pesquisas";
import { CampoDaResposta } from "@/components/pesquisa-discreta";
import { capturarNoNavegador } from "@/lib/observabilidade-navegador";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

/**
 * A pesquisa aberta pela notificação: página inteira, uma pergunta, sem
 * distração. Registra o funil — viu (ao abrir), começou (primeiro toque na
 * resposta), respondeu.
 */
export function PesquisaNaPagina({
  pesquisa,
  area,
  empresaId,
  voltarPara,
}: {
  pesquisa: PesquisaParaResponder;
  area: "equipe" | "cliente";
  empresaId: string;
  voltarPara: string;
}) {
  const [valor, setValor] = useState<Resposta | null>(null);
  const [comentario, setComentario] = useState("");
  const [estado, setEstado] = useState<"aberta" | "enviando" | "respondida" | "encerrada">(pesquisa.situacao);
  const [erro, setErro] = useState<string | null>(null);
  const iniciada = useRef(false);

  useEffect(() => {
    if (pesquisa.situacao === "aberta") void marcarPesquisaExibida(pesquisa.id, area, empresaId).catch(() => {});
  }, [pesquisa.id, pesquisa.situacao, area, empresaId]);

  function mudar(v: Resposta | null) {
    setValor(v);
    if (!iniciada.current && v !== null) {
      iniciada.current = true;
      void marcarPesquisaIniciada(pesquisa.id, area, empresaId).catch(() => {});
    }
  }

  const normalizada = valor === null ? null : normalizarResposta(pesquisa.tipo, pesquisa.opcoes, valor);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (normalizada === null) return setErro("Escolha uma resposta.");
    setErro(null);
    setEstado("enviando");
    try {
      const r = await responderPesquisa(pesquisa.id, area, empresaId, normalizada, comentario.trim() || undefined);
      if (!r.ok) {
        setErro(r.error);
        setEstado("aberta");
        return;
      }
      setEstado("respondida");
    } catch (e) {
      capturarNoNavegador(e, "pesquisa.responder");
      setErro("Não conseguimos enviar agora. Tente de novo em instantes.");
      setEstado("aberta");
    }
  }

  if (estado === "respondida" || estado === "encerrada") {
    return (
      <div className="rounded-md border border-border bg-surface p-6" role="status">
        <p className="font-heading text-section-title text-foreground">
          {estado === "respondida" ? "Obrigado pela resposta." : "Esta pesquisa já foi encerrada."}
        </p>
        <p className="text-body-sm text-muted mt-1.5">
          {estado === "respondida"
            ? "Ela vai direto para quem decide o que o CORTEX melhora."
            : "Obrigado por abrir. Quando houver outra, avisamos."}
        </p>
        <Link href={voltarPara} className="alvo-toque mt-4 inline-block text-body-sm text-foreground underline underline-offset-4">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="rounded-md border border-border bg-surface p-5 sm:p-6">
      <p className="font-subtitle text-micro uppercase tracking-label text-muted flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 bg-brand-blue" />
        Pesquisa rápida
      </p>
      <h1 className="font-heading text-section-title text-foreground mt-2">{pesquisa.pergunta}</h1>
      <div className="mt-5">
        <CampoDaResposta pesquisa={pesquisa} valor={valor} onChange={mudar} rotulo={pesquisa.pergunta} />
      </div>
      {pesquisa.permite_comentario && pesquisa.tipo !== "texto" && (
        <label className="mt-4 block">
          <span className="text-caption text-muted">Comentário (opcional)</span>
          <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={LIMITE_DO_TEXTO} rows={3} className="mt-1 block" />
        </label>
      )}
      {erro && (
        <p role="alert" className="mt-3 text-caption text-danger-ink">
          {erro}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <Link href={voltarPara} className="alvo-toque text-body-sm text-muted hover:text-foreground px-2">
          Agora não
        </Link>
        <Button type="submit" disabled={estado === "enviando" || normalizada === null}>
          {estado === "enviando" ? "Enviando…" : "Enviar resposta"}
        </Button>
      </div>
    </form>
  );
}
