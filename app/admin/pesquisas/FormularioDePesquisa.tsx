"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { salvarPesquisa } from "@/actions/pesquisas";
import {
  TIPOS_DE_PESQUISA,
  PUBLICOS,
  FUNCIONALIDADES,
  errosDaPesquisa,
  limparOpcoes,
  type TipoDePesquisa,
  type Publico,
  type Funcionalidade,
  type Resposta,
} from "@/lib/pesquisas";
import { CampoDaResposta } from "@/components/pesquisa-discreta";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export type ValoresDaPesquisa = {
  id: string | null;
  titulo: string;
  pergunta: string;
  tipo: TipoDePesquisa;
  opcoes: string[];
  permiteComentario: boolean;
  funcionalidade: Funcionalidade;
  publico: Publico[];
  publicarEm: string | null;
  encerrarEm: string | null;
};

const VAZIA: ValoresDaPesquisa = {
  id: null,
  titulo: "",
  pergunta: "",
  tipo: "nota",
  opcoes: [],
  permiteComentario: true,
  funcionalidade: "geral",
  publico: ["gestor"],
  publicarEm: null,
  encerrarEm: null,
};

// datetime-local trabalha em horário local sem fuso; o banco guarda instante.
const paraCampo = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const doCampo = (v: string) => (v ? new Date(v).toISOString() : null);

/**
 * Criar ou editar uma pesquisa. Depois de publicada, só o título interno e a
 * data de encerramento mudam — pergunta, tipo, opções e público travam para
 * não misturar respostas a perguntas diferentes (o banco garante isso).
 */
export function FormularioDePesquisa({
  inicial,
  travada = false,
  aoSalvar,
}: {
  inicial?: ValoresDaPesquisa;
  travada?: boolean;
  aoSalvar?: (id: string) => void;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [v, setV] = useState<ValoresDaPesquisa>(inicial ?? VAZIA);
  const [opcoesTexto, setOpcoesTexto] = useState((inicial?.opcoes ?? []).join("\n"));
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState<Resposta | null>(null);

  const temOpcoes = v.tipo === "escolha" || v.tipo === "multipla";
  const opcoes = temOpcoes ? limparOpcoes(opcoesTexto.split("\n")) : [];
  const erros = errosDaPesquisa({ ...v, opcoes });
  const mostrar = (campo: keyof typeof erros) => (tentou ? erros[campo] : undefined);

  function alterar<K extends keyof ValoresDaPesquisa>(campo: K, valor: ValoresDaPesquisa[K]) {
    setV((atual) => ({ ...atual, [campo]: valor }));
    if (campo === "tipo") setPrevia(null);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    if (Object.keys(erros).length > 0) return;
    setSalvando(true);
    const r = await salvarPesquisa({ ...v, opcoes, publicarEm: v.publicarEm ?? "", encerrarEm: v.encerrarEm ?? "" });
    setSalvando(false);
    if (!r.ok) {
      show(r.error, "danger");
      return;
    }
    show(v.id ? "Pesquisa atualizada." : "Rascunho criado. Revise e publique quando quiser.", "success");
    if (aoSalvar) aoSalvar(r.data.id);
    else router.push(`/admin/pesquisas/${r.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <Field name="titulo" label="Nome interno" required error={mostrar("titulo")} helper="Só aparece aqui no Admin.">
          <Input value={v.titulo} onChange={(e) => alterar("titulo", e.target.value)} maxLength={80} />
        </Field>

        <Field name="pergunta" label="Pergunta" required error={mostrar("pergunta")} helper={travada ? "Travada depois de publicar." : "É o que a pessoa lê. Uma pergunta só, direta."}>
          <Textarea value={v.pergunta} onChange={(e) => alterar("pergunta", e.target.value)} maxLength={240} rows={2} disabled={travada} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="tipo" label="Tipo de resposta" required>
            <Select value={v.tipo} onChange={(e) => alterar("tipo", e.target.value as TipoDePesquisa)} disabled={travada}>
              {Object.entries(TIPOS_DE_PESQUISA).map(([k, r]) => (
                <option key={k} value={k}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field name="funcionalidade" label="Funcionalidade" helper="Para cruzar a resposta com o uso do módulo.">
            <Select value={v.funcionalidade} onChange={(e) => alterar("funcionalidade", e.target.value as Funcionalidade)} disabled={travada}>
              {Object.entries(FUNCIONALIDADES).map(([k, r]) => (
                <option key={k} value={k}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {temOpcoes && (
          <Field name="opcoes" label="Opções" required error={mostrar("opcoes")} helper="Uma por linha, de 2 a 8. Repetidas são ignoradas.">
            <Textarea value={opcoesTexto} onChange={(e) => setOpcoesTexto(e.target.value)} rows={4} disabled={travada} />
          </Field>
        )}

        {v.tipo !== "texto" && (
          <label className="flex items-center gap-2.5 text-body-sm text-foreground">
            <Checkbox checked={v.permiteComentario} onChange={(e) => alterar("permiteComentario", e.target.checked)} disabled={travada} />
            Permitir comentário opcional
          </label>
        )}

        <fieldset className="space-y-2">
          <legend className="block text-label uppercase text-muted">
            Público <span className="text-danger-ink">*</span>
          </legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {(Object.entries(PUBLICOS) as [Publico, string][]).map(([k, r]) => (
              <label key={k} className="flex items-center gap-2 text-body-sm text-foreground">
                <Checkbox
                  checked={v.publico.includes(k)}
                  disabled={travada}
                  onChange={(e) => alterar("publico", e.target.checked ? [...v.publico, k] : v.publico.filter((x) => x !== k))}
                />
                {r}
              </label>
            ))}
          </div>
          {mostrar("publico") && <p className="text-caption text-danger-ink">{mostrar("publico")}</p>}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="publicarEm" label="Publicar a partir de" helper={travada ? undefined : "Vazio: vale assim que você publicar."}>
            <Input type="datetime-local" value={paraCampo(v.publicarEm)} onChange={(e) => alterar("publicarEm", doCampo(e.target.value))} disabled={travada} />
          </Field>
          <Field name="encerrarEm" label="Encerrar em (opcional)" error={mostrar("encerrarEm")}>
            <Input type="datetime-local" value={paraCampo(v.encerrarEm)} onChange={(e) => alterar("encerrarEm", doCampo(e.target.value))} />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : v.id ? "Salvar alterações" : "Salvar rascunho"}
          </Button>
        </div>
      </div>

      <aside aria-label="Prévia" className="lg:sticky lg:top-6 self-start">
        <p className="text-label uppercase text-muted mb-2">Como a pessoa vê</p>
        <div className="rounded-md border border-border bg-surface p-4 shadow-[var(--shadow-md)]">
          <p className="font-subtitle text-micro uppercase tracking-label text-muted flex items-center gap-1.5">
            <span aria-hidden className="size-1.5 bg-brand-blue" />
            Pesquisa rápida
          </p>
          <p className="text-body font-medium text-foreground mt-1.5 break-words">{v.pergunta.trim() || "Sua pergunta aparece aqui."}</p>
          <div className="mt-4">
            {temOpcoes && opcoes.length < 2 ? (
              <p className="text-caption text-muted">Adicione pelo menos duas opções.</p>
            ) : (
              <CampoDaResposta
                pesquisa={{ id: "previa", titulo: v.titulo, pergunta: v.pergunta, tipo: v.tipo, opcoes, permite_comentario: v.permiteComentario, publico: v.publico[0] ?? "gestor" }}
                valor={previa}
                onChange={setPrevia}
                rotulo="Prévia da resposta"
              />
            )}
          </div>
          {v.permiteComentario && v.tipo !== "texto" && <p className="mt-3 text-caption text-muted underline underline-offset-4">Adicionar um comentário</p>}
          <div className="mt-4 flex justify-end gap-2" aria-hidden>
            <span className="h-8 px-3 grid place-items-center text-button text-foreground">Agora não</span>
            <span className="h-8 px-3 grid place-items-center rounded-sm bg-primary text-primary-foreground text-button opacity-60">Enviar</span>
          </div>
        </div>
        <p className="text-caption text-muted mt-2">
          Aparece no canto da tela, alguns segundos depois de abrir, e nunca durante atendimento, venda ou caixa. Fechar conta como “não quero responder”: a pesquisa não volta.
        </p>
      </aside>
    </form>
  );
}
