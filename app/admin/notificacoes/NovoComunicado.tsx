"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarComunicado, enviarComunicado, previaDoComunicado } from "@/actions/notificacoes-admin";
import { TIPOS_COMUNICAVEIS, PAPEIS_DE_DESTINO, ROTULO_DA_PRIORIDADE, destinoSeguro, type Prioridade } from "@/lib/notificacoes/catalogo";
import { Field, Input, Select, Textarea, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

type Papel = (typeof PAPEIS_DE_DESTINO)[number]["chave"];

// Crítica só para manutenção; produto nunca passa de normal (o banco confere).
const PRIORIDADES_POR_TIPO: Record<string, Prioridade[]> = {
  "produto.novidade": ["informational", "normal"],
  "produto.beta": ["informational", "normal"],
  "sistema.atualizacao": ["informational", "normal", "important"],
  "sistema.manutencao": ["important", "critical"],
};

const PUBLICO_DA_PREVIA: Record<string, string> = { gestor: "donos e gerência", profissional: "profissionais", cliente: "clientes" };

/**
 * Novo comunicado. Salvar = rascunho; enviar pede confirmação com o alcance
 * calculado pelo banco (as mesmas regras do envio). Com data futura, agenda.
 */
export function NovoComunicado({ empresas }: { empresas: { id: string; name: string }[] }) {
  const router = useRouter();
  const { show } = useToast();
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [tipo, setTipo] = useState(TIPOS_COMUNICAVEIS[0].chave);
  const [prioridade, setPrioridade] = useState<Prioridade>("informational");
  const [papeis, setPapeis] = useState<Papel[]>(["owner", "admin"]);
  const [todasEmpresas, setTodasEmpresas] = useState(true);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [enviarEm, setEnviarEm] = useState("");
  const [alcance, setAlcance] = useState<Record<string, number> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const permitidas = PRIORIDADES_POR_TIPO[tipo] ?? ["informational"];
  useEffect(() => {
    if (!permitidas.includes(prioridade)) setPrioridade(permitidas[0]);
  }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const empresasDoEnvio = todasEmpresas ? null : escolhidas;
  useEffect(() => {
    if (!aberto || papeis.length === 0 || (!todasEmpresas && escolhidas.length === 0)) {
      setAlcance(null);
      return;
    }
    const t = window.setTimeout(() => {
      void previaDoComunicado(papeis, empresasDoEnvio).then(setAlcance);
    }, 350);
    return () => window.clearTimeout(t);
  }, [aberto, papeis, todasEmpresas, escolhidas]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalAlcance = alcance ? Object.values(alcance).reduce((s, n) => s + n, 0) : null;
  const urlInvalida = url.trim() !== "" && destinoSeguro(url) === null;
  const agendado = enviarEm && new Date(enviarEm).getTime() > Date.now() + 60_000;

  function alternarPapel(p: Papel) {
    setPapeis((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]));
  }

  async function salvar(enviarDepois: boolean) {
    setErro(null);
    if (!todasEmpresas && escolhidas.length === 0) return setErro("Escolha ao menos uma barbearia.");
    setOcupado(true);
    const r = await salvarComunicado({
      id: null,
      titulo,
      mensagem,
      tipo,
      prioridade,
      url: url.trim() || null,
      papeis,
      empresas: empresasDoEnvio,
      enviarEm: enviarEm ? new Date(enviarEm).toISOString() : null,
    });
    if (!r.ok) {
      setOcupado(false);
      setConfirmar(false);
      return setErro(r.error);
    }
    if (!enviarDepois) {
      setOcupado(false);
      show("Rascunho salvo.", "success");
      setAberto(false);
      return router.refresh();
    }
    const e = await enviarComunicado(r.data.id);
    setOcupado(false);
    setConfirmar(false);
    if (!e.ok) return setErro(`Salvo como rascunho, mas não enviado: ${e.error}`);
    show(
      e.data.agendado
        ? "Comunicado agendado."
        : `Enviado para ${e.data.destinatarios ?? 0} ${e.data.destinatarios === 1 ? "pessoa" : "pessoas"}${e.data.limitados ? ` (${e.data.limitados} fora pelo limite semanal)` : ""}.`,
      "success"
    );
    setAberto(false);
    router.refresh();
  }

  if (!aberto) return <Button onClick={() => setAberto(true)}>Novo comunicado</Button>;

  return (
    <section className="painel p-5 sm:p-6 w-full" aria-labelledby="novo-comunicado">
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 id="novo-comunicado" className="text-section-title text-foreground">
          Novo comunicado
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setConfirmar(true);
        }}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="space-y-4 min-w-0">
          <Field name="titulo" label="Título" required helper={`${titulo.length}/90`}>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={90} required minLength={3} />
          </Field>
          <Field name="mensagem" label="Mensagem" required helper={`${mensagem.length}/300 — o que mudou e o que a pessoa ganha com isso.`}>
            <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={300} rows={3} required minLength={3} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="tipo" label="Categoria">
              <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS_COMUNICAVEIS.map((t) => (
                  <option key={t.chave} value={t.chave}>
                    {t.rotulo}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="prioridade" label="Prioridade" helper="Crítica só para manutenção que exige ação.">
              <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}>
                {permitidas.map((p) => (
                  <option key={p} value={p}>
                    {ROTULO_DA_PRIORIDADE[p]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="block text-label uppercase text-muted mb-1.5">Destino</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <label className="flex items-center gap-2 text-body-sm text-foreground min-h-9">
                <Checkbox
                  checked={papeis.length === PAPEIS_DE_DESTINO.length}
                  onChange={(e) => setPapeis(e.target.checked ? PAPEIS_DE_DESTINO.map((p) => p.chave) : [])}
                />
                Todos
              </label>
              {PAPEIS_DE_DESTINO.map((p) => (
                <label key={p.chave} className="flex items-center gap-2 text-body-sm text-foreground min-h-9">
                  <Checkbox checked={papeis.includes(p.chave)} onChange={() => alternarPapel(p.chave)} />
                  {p.rotulo}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
              <label className="flex items-center gap-2 text-body-sm text-foreground min-h-9">
                <input type="radio" name="escopo" checked={todasEmpresas} onChange={() => setTodasEmpresas(true)} className="accent-primary size-4" />
                Todas as barbearias
              </label>
              <label className="flex items-center gap-2 text-body-sm text-foreground min-h-9">
                <input type="radio" name="escopo" checked={!todasEmpresas} onChange={() => setTodasEmpresas(false)} className="accent-primary size-4" />
                Barbearias selecionadas
              </label>
            </div>
            {!todasEmpresas && (
              <ul className="max-h-48 overflow-y-auto rounded-sm border border-border divide-y divide-border">
                {empresas.map((e) => (
                  <li key={e.id}>
                    <label className="flex items-center gap-2.5 px-3 py-2 text-body-sm text-foreground">
                      <Checkbox
                        checked={escolhidas.includes(e.id)}
                        onChange={() => setEscolhidas((l) => (l.includes(e.id) ? l.filter((x) => x !== e.id) : [...l, e.id]))}
                      />
                      <span className="truncate">{e.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="url" label="Ação (opcional)" error={urlInvalida ? "Use um caminho do CORTEX, como /agenda." : null} helper="Para onde o toque leva. Ex.: /agenda">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/agenda" inputMode="url" />
            </Field>
            <Field name="enviar_em" label="Data de envio (opcional)" helper="Vazio = envia assim que confirmar.">
              <Input type="datetime-local" value={enviarEm} onChange={(e) => setEnviarEm(e.target.value)} />
            </Field>
          </div>

          {erro && (
            <p role="alert" className="text-body-sm text-danger-ink">
              {erro}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" disabled={ocupado || papeis.length === 0 || urlInvalida}>
              {agendado ? "Agendar" : "Enviar"}
            </Button>
            <Button type="button" variant="secondary" disabled={ocupado} onClick={() => salvar(false)}>
              Salvar rascunho
            </Button>
          </div>
        </div>

        <aside aria-label="Prévia" className="space-y-3">
          <p className="font-subtitle text-micro uppercase tracking-label text-muted">Como aparece</p>
          <div className="rounded-md border border-border bg-surface p-3.5">
            <p className={cn("text-body-sm text-foreground font-semibold break-words", !titulo && "text-muted font-normal")}>{titulo || "Título do comunicado"}</p>
            <p className={cn("text-body-sm mt-0.5 break-words", mensagem ? "text-foreground/85" : "text-muted")}>{mensagem || "A mensagem aparece aqui."}</p>
            <p className="text-caption text-muted mt-1">Agora</p>
          </div>
          <div className="rounded-md border border-border p-3.5" aria-live="polite">
            <p className="font-subtitle text-micro uppercase tracking-label text-muted">Alcance</p>
            {totalAlcance === null ? (
              <p className="text-caption text-muted mt-1">Escolha o destino.</p>
            ) : (
              <>
                <p className="numero text-metric-sm text-foreground mt-1">{totalAlcance}</p>
                <p className="text-caption text-muted">
                  {Object.entries(alcance!)
                    .map(([k, n]) => `${n} ${PUBLICO_DA_PREVIA[k] ?? k}`)
                    .join(" · ") || "ninguém"}
                </p>
                <p className="text-micro text-muted mt-1.5">
                  Quem desligou este tipo de aviso não recebe. Produto: no máximo 2 por pessoa por semana.
                </p>
              </>
            )}
          </div>
        </aside>
      </form>

      <Modal open={confirmar} onClose={() => !ocupado && setConfirmar(false)} title={agendado ? "Agendar comunicado" : "Enviar comunicado"}>
        <p className="text-body-sm text-foreground">
          {agendado ? `Sai em ${new Date(enviarEm).toLocaleString("pt-BR")}` : "Sai agora"} para até{" "}
          <strong>{totalAlcance ?? "—"}</strong> {totalAlcance === 1 ? "pessoa" : "pessoas"}. Depois de enviado, não dá para desfazer.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmar(false)} disabled={ocupado}>
            Voltar
          </Button>
          <Button onClick={() => salvar(true)} disabled={ocupado}>
            {ocupado ? "Enviando…" : agendado ? "Agendar" : "Enviar agora"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
