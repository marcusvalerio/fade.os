"use client";

import { useState } from "react";
import { atualizarMeuCadastro, type MeuCadastro } from "@/actions/cliente";
import { useEnvioComEstado } from "@/lib/enviar-sem-limpar";
import { Field, Input, Checkbox } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/ui/estado";

/** Os dados do próprio cadastro nesta barbearia. O e-mail é o da conta. */
export function SeusDados({ slug, cadastro }: { slug: string; cadastro: MeuCadastro }) {
  const { estado, aoEnviar, pendente } = useEnvioComEstado<{ ok: boolean | null; mensagem: string | null }>(
    atualizarMeuCadastro.bind(null, slug),
    { ok: null, mensagem: null },
    { origem: "minha-conta.dados", falha: (mensagem) => ({ ok: false, mensagem }) }
  );
  const [nome, setNome] = useState(cadastro.name);
  const [telefone, setTelefone] = useState(cadastro.phone ?? "");
  const [consentimento, setConsentimento] = useState(cadastro.communication_consent);

  // onSubmit, e não action: o reset do React 19 devolvia a caixa de
  // consentimento a como ela nasceu depois de cada envio — a tela mostrava
  // marcada, o estado dizia desmarcada, e o próximo "Salvar" religava o
  // WhatsApp de quem tinha desligado.
  return (
    <form onSubmit={aoEnviar} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field name="name" label="Nome">
          <Input name="name" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} maxLength={120} autoComplete="name" />
        </Field>
        <Field name="phone" label="Telefone / WhatsApp" helper="Com DDD.">
          <Input name="phone" value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" autoComplete="tel" />
        </Field>
      </div>
      <p className="text-caption text-muted">E-mail da conta: {cadastro.email ?? "—"}</p>
      <label className="flex items-start gap-3 text-body-sm text-foreground">
        <Checkbox name="consent" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} className="mt-0.5" />
        <span>
          A barbearia pode me chamar no WhatsApp para lembrar de voltar.
          <span className="block text-caption text-muted">Você pode desmarcar quando quiser.</span>
        </span>
      </label>
      {estado.mensagem && <Aviso tom={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Aviso>}
      <Button type="submit" variant="secondary" pending={pendente}>
        {pendente ? "Salvando…" : "Salvar dados"}
      </Button>
    </form>
  );
}
