"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { enviarPesquisaComoNotificacao } from "@/actions/notificacoes-admin";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/**
 * Transforma a pesquisa publicada numa notificação para o público dela —
 * uma vez só (o banco recusa a segunda). Quem já respondeu ou fechou não
 * recebe; quem recebeu 2 avisos de produto na semana fica de fora.
 */
export function EnviarPesquisa({
  pesquisaId,
  pergunta,
  empresas,
}: {
  pesquisaId: string;
  pergunta: string;
  empresas: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { show } = useToast();
  const [titulo, setTitulo] = useState("Queremos ouvir você");
  const [mensagem, setMensagem] = useState(pergunta.length <= 300 ? pergunta : pergunta.slice(0, 297) + "…");
  const [todas, setTodas] = useState(true);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [enviarEm, setEnviarEm] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setOcupado(true);
    setErro(null);
    const r = await enviarPesquisaComoNotificacao({
      pesquisaId,
      titulo,
      mensagem,
      empresas: todas ? null : escolhidas,
      enviarEm: enviarEm ? new Date(enviarEm).toISOString() : null,
    });
    setOcupado(false);
    setConfirmar(false);
    if (!r.ok) return setErro(r.error);
    show(
      r.data.agendado
        ? "Envio agendado."
        : `Enviada para ${r.data.destinatarios ?? 0} ${r.data.destinatarios === 1 ? "pessoa" : "pessoas"}${r.data.limitados ? ` · ${r.data.limitados} fora pelo limite semanal` : ""}${r.data.ignorados ? ` · ${r.data.ignorados} já tinham respondido ou desligaram` : ""}.`,
      "success"
    );
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!todas && escolhidas.length === 0) return setErro("Escolha ao menos uma barbearia.");
        setConfirmar(true);
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="titulo_aviso" label="Título do aviso" required helper={`${titulo.length}/90`}>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={90} minLength={3} required />
        </Field>
        <Field name="enviar_em_aviso" label="Data de envio (opcional)" helper="Vazio = agora.">
          <Input type="datetime-local" value={enviarEm} onChange={(e) => setEnviarEm(e.target.value)} />
        </Field>
      </div>
      <Field name="mensagem_aviso" label="Mensagem" required helper={`${mensagem.length}/300`}>
        <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={300} minLength={3} rows={2} required />
      </Field>
      <fieldset>
        <legend className="block text-label uppercase text-muted mb-1.5">Barbearias</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 text-body-sm text-foreground min-h-9">
            <input type="radio" name="escopo_pesquisa" checked={todas} onChange={() => setTodas(true)} className="accent-primary size-4" />
            Todas
          </label>
          <label className="flex items-center gap-2 text-body-sm text-foreground min-h-9">
            <input type="radio" name="escopo_pesquisa" checked={!todas} onChange={() => setTodas(false)} className="accent-primary size-4" />
            Selecionadas
          </label>
        </div>
        {!todas && (
          <ul className="mt-2 max-h-44 overflow-y-auto rounded-sm border border-border divide-y divide-border">
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
      {erro && (
        <p role="alert" className="text-body-sm text-danger-ink">
          {erro}
        </p>
      )}
      <Button type="submit" disabled={ocupado}>
        Enviar como notificação
      </Button>

      <Modal open={confirmar} onClose={() => !ocupado && setConfirmar(false)} title="Enviar pesquisa">
        <p className="text-body-sm text-foreground">
          O público desta pesquisa recebe um aviso que abre a pergunta. Isso só pode ser feito uma vez por pesquisa.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmar(false)} disabled={ocupado}>
            Voltar
          </Button>
          <Button onClick={enviar} disabled={ocupado}>
            {ocupado ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </Modal>
    </form>
  );
}
