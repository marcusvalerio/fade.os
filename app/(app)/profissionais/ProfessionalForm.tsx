"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { BotaoDeAcao } from "@/components/ui/botao-de-acao";
import { Aviso } from "@/components/ui/estado";
import { Formulario, GrupoDeCampos, AcoesDoFormulario } from "@/components/ui/formulario";
import { CATALOGO } from "@/lib/catalogo";
import type { ProfessionalFormState } from "@/actions/profissionais";

/**
 * O formulário de profissional, um só para criar e editar.
 *
 * O agrupamento trata a pessoa como entidade OPERACIONAL, que é o que ela é
 * aqui: quem é e o que faz, como se fala com ela, e quanto ela ganha. A
 * comissão fica sozinha no último grupo de propósito — é a única decisão da
 * tela que mexe em dinheiro, e ela estava perdida no meio de e-mail e
 * telefone.
 */
type Valores = {
  name?: string;
  role_title?: string | null;
  email?: string | null;
  phone?: string | null;
  default_commission_percent?: number | string | null;
};

export function ProfessionalForm({
  action,
  companyId,
  unidades,
  valores,
  modo,
}: {
  action: (state: ProfessionalFormState, formData: FormData) => Promise<ProfessionalFormState>;
  companyId?: string;
  unidades?: { id: string; name: string }[];
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
      {unidades?.length === 1 && <input type="hidden" name="unit_id" value={unidades[0].id} />}

      {state.error && (
        <div className="px-5 pt-5 sm:px-6">
          <Aviso tom="erro" titulo="Não foi possível salvar">
            {state.error}
          </Aviso>
        </div>
      )}

      <GrupoDeCampos titulo="Quem é">
        <Field name="name" label="Nome" required>
          <Input id="name" name="name" defaultValue={val("name", v.name)} required autoFocus={modo === "novo"} autoComplete="name" />
        </Field>
        <Field
          name="role_title"
          label="Função"
          helper="Aparece na vitrine e é o que separa dois profissionais de mesmo nome."
        >
          <Input id="role_title" name="role_title" defaultValue={val("role_title", v.role_title)} placeholder="Ex.: Barbeiro, Gerente, Recepção" />
        </Field>
        {unidades && unidades.length > 1 && (
          <Field name="unit_id" label="Unidade" required>
            <Select id="unit_id" name="unit_id" required>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </GrupoDeCampos>

      <GrupoDeCampos titulo="Contato" descricao="Opcional — como a barbearia fala com essa pessoa.">
        <Field name="email" label="E-mail">
          <Input id="email" name="email" type="email" defaultValue={val("email", v.email)} autoComplete="email" />
        </Field>
        <Field name="phone" label="Telefone">
          <Input id="phone" name="phone" defaultValue={val("phone", v.phone)} inputMode="tel" autoComplete="tel" />
        </Field>
      </GrupoDeCampos>

      <GrupoDeCampos
        titulo="Comissão"
        descricao="Percentual padrão sobre o que essa pessoa realiza. Cada serviço pode ter o seu, e o do serviço prevalece."
      >
        <Field name="default_commission_percent" label="Comissão padrão (%)">
          <Input
            id="default_commission_percent"
            name="default_commission_percent"
            type="number"
            step="0.01"
            inputMode="decimal"
            min={CATALOGO.comissaoMin}
            max={CATALOGO.comissaoMax}
            defaultValue={val("default_commission_percent", v.default_commission_percent)}
          />
        </Field>
      </GrupoDeCampos>

      <AcoesDoFormulario
        ajuda={modo === "novo" ? "Depois de salvo, falta vincular os serviços que ele executa." : undefined}
      >
        <Link href="/profissionais" className={buttonClasses({ variant: "ghost" })}>
          Cancelar
        </Link>
        <BotaoDeAcao
          rotuloPendente="Salvando…"
          rotuloConcluido={modo === "novo" ? "Profissional criado" : "Alterações salvas"}
        >
          {modo === "novo" ? "Salvar profissional" : "Salvar alterações"}
        </BotaoDeAcao>
      </AcoesDoFormulario>
    </Formulario>
  );
}
