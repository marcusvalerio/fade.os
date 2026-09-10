"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { BotaoDeAcao } from "@/components/ui/botao-de-acao";
import { Aviso } from "@/components/ui/estado";
import { Formulario, GrupoDeCampos, AcoesDoFormulario } from "@/components/ui/formulario";
import type { ClientFormState } from "@/actions/clientes";

/**
 * O formulário de cliente, um só para criar e editar.
 *
 * Dois motivos para ele ser client component:
 *
 * 1. `useActionState` devolve o erro à tela em vez de deixá-lo estourar na
 *    error boundary — o que preserva tudo o que a pessoa já digitou. Um
 *    formulário que apaga o trabalho no erro é pior do que um que não valida.
 * 2. `BotaoDeAcao` lê `useFormStatus`, e para isso precisa estar dentro do
 *    <form> que está enviando.
 *
 * `noValidate` é deliberado, pelo mesmo motivo do formulário de serviço: sem
 * ele o navegador barra primeiro e mostra a frase dele. Aqui quem recusa e
 * escreve a mensagem é a validação de domínio, em português.
 */
type Valores = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  birth_date?: string | null;
  notes?: string | null;
  communication_consent?: boolean;
};

export function ClientForm({
  action,
  companyId,
  valores,
  modo,
}: {
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  companyId?: string;
  valores?: Valores;
  modo: "novo" | "editar";
}) {
  const [state, formAction] = useActionState(action, { error: null });
  // O eco vem primeiro: depois de um erro, o campo tem que renascer com o
  // que a pessoa escreveu, não com o valor que estava lá antes.
  const eco = state.valores;
  const v = valores ?? {};
  const val = (chave: string, queda?: string | number | null) =>
    eco?.[chave] ?? (queda != null ? String(queda) : "");

  return (
    <Formulario action={formAction} noValidate>
      {companyId && <input type="hidden" name="company_id" value={companyId} />}

      {/*
        O erro fica no topo do formulário, não num toast: ele precisa
        sobreviver enquanto a pessoa corrige o campo, e um toast some em
        quatro segundos.
      */}
      {state.error && (
        <div className="px-5 pt-5 sm:px-6">
          <Aviso tom="erro" titulo="Não foi possível salvar">
            {state.error}
          </Aviso>
        </div>
      )}

      <GrupoDeCampos titulo="Identidade">
        <Field name="name" label="Nome" required>
          <Input id="name" name="name" defaultValue={val("name", v.name)} required autoFocus={modo === "novo"} autoComplete="name" />
        </Field>
        <Field
          name="phone"
          label="Telefone"
          helper="Usado na busca e para diferenciar pessoas de mesmo nome."
        >
          <Input id="phone" name="phone" defaultValue={val("phone", v.phone)} inputMode="tel" autoComplete="tel" />
        </Field>
        <Field name="email" label="E-mail">
          <Input id="email" name="email" type="email" defaultValue={val("email", v.email)} autoComplete="email" />
        </Field>
      </GrupoDeCampos>

      <GrupoDeCampos
        titulo="Relacionamento"
        descricao="Opcional — o que ajuda a atender melhor essa pessoa da próxima vez."
      >
        <Field name="birth_date" label="Data de nascimento">
          <Input id="birth_date" name="birth_date" type="date" defaultValue={val("birth_date", v.birth_date)} />
        </Field>
        <Field name="notes" label="Observações" helper="Preferência de corte, alergia, o que for lembrar.">
          <Textarea id="notes" name="notes" rows={3} defaultValue={val("notes", v.notes)} />
        </Field>
        <label className="flex items-center gap-2.5 text-body-sm text-foreground">
          <Checkbox name="communication_consent" defaultChecked={v.communication_consent ?? true} />
          Aceita receber comunicações
        </label>
      </GrupoDeCampos>

      <AcoesDoFormulario
        ajuda={modo === "novo" ? "Depois de salvo, já pode ser agendado." : undefined}
      >
        <Link href="/clientes" className={buttonClasses({ variant: "ghost" })}>
          Cancelar
        </Link>
        <BotaoDeAcao
          rotuloPendente="Salvando…"
          rotuloConcluido={modo === "novo" ? "Cliente criado" : "Alterações salvas"}
        >
          {modo === "novo" ? "Salvar cliente" : "Salvar alterações"}
        </BotaoDeAcao>
      </AcoesDoFormulario>
    </Formulario>
  );
}
