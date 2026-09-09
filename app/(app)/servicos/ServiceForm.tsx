"use client";

import { useActionState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CATALOGO } from "@/lib/catalogo";
import type { ServiceFormState } from "@/actions/servicos";

type Valores = {
  name?: string;
  description?: string | null;
  category?: string | null;
  default_price?: number | string;
  planned_duration_minutes?: number | string;
  default_commission_percent?: number | string | null;
  status?: string;
  is_public?: boolean;
};

/**
 * O formulário de serviço, um só para criar e editar.
 *
 * `noValidate` é deliberado: com min/max nativos, o navegador barrava antes e
 * dizia "Value must be greater than or equal to 0.01" — em inglês, e sem
 * explicar por quê. Os atributos continuam ali pelo controle numérico, mas
 * quem recusa e escreve a frase é a validação de domínio, em português.
 */
export function ServiceForm({
  action,
  companyId,
  valores,
  modo,
}: {
  action: (state: ServiceFormState, formData: FormData) => Promise<ServiceFormState>;
  companyId?: string;
  valores?: Valores;
  modo: "novo" | "editar";
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const v = valores ?? {};

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-md border border-border bg-surface p-6 space-y-4"
    >
      {companyId && <input type="hidden" name="company_id" value={companyId} />}

      <Field name="name" label="Nome" required>
        <Input
          id="name"
          name="name"
          defaultValue={v.name ?? ""}
          maxLength={CATALOGO.nomeMax}
          autoFocus={modo === "novo"}
        />
      </Field>

      <Field name="description" label="Descrição">
        <Textarea id="description" name="description" rows={2} defaultValue={v.description ?? ""} />
      </Field>

      <Field name="category" label="Categoria">
        <Input id="category" name="category" defaultValue={v.category ?? ""} maxLength={CATALOGO.nomeMax} />
      </Field>

      <Field name="default_price" label="Preço (R$)" required>
        <Input
          id="default_price"
          name="default_price"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={v.default_price?.toString() ?? ""}
        />
      </Field>

      <Field name="planned_duration_minutes" label="Duração planejada (minutos)" required>
        <Input
          id="planned_duration_minutes"
          name="planned_duration_minutes"
          type="number"
          min={CATALOGO.duracaoMin}
          max={CATALOGO.duracaoMax}
          defaultValue={v.planned_duration_minutes?.toString() ?? ""}
        />
      </Field>

      <Field name="default_commission_percent" label="Comissão padrão (%)">
        <Input
          id="default_commission_percent"
          name="default_commission_percent"
          type="number"
          step="0.01"
          min={CATALOGO.comissaoMin}
          max={CATALOGO.comissaoMax}
          defaultValue={v.default_commission_percent?.toString() ?? ""}
        />
      </Field>

      {modo === "editar" && (
        <Field name="status" label="Status">
          <Select id="status" name="status" defaultValue={v.status ?? "active"}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </Select>
        </Field>
      )}

      {/* is_public existia no banco desde o começo, mas nenhuma tela chegava
          até ele — por isso tudo que estava ativo ia parar na vitrine. Ativo e
          publicado são coisas diferentes. */}
      <label className="flex items-start justify-between gap-3 rounded-md border border-border px-4 py-3 cursor-pointer">
        <span>
          <span className="block text-body-sm text-foreground">Mostrar na página pública</span>
          <span className="block text-caption text-muted mt-0.5">
            Desmarque para um serviço interno: continua ativo para uso no balcão, mas some da
            vitrine e do agendamento online.
          </span>
        </span>
        <input
          type="checkbox"
          name="is_public"
          defaultChecked={v.is_public !== false}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
        />
      </label>

      {modo === "editar" && (
        <p className="text-helper text-muted">
          Alterar preço ou comissão aqui não afeta atendimentos já registrados — eles guardam o
          valor congelado no momento em que foram feitos.
        </p>
      )}

      {state.error && <p className="text-body-sm text-danger">{state.error}</p>}

      <Button type="submit" pending={pending} className="w-full">
        {modo === "novo" ? "Cadastrar serviço" : "Salvar alterações"}
      </Button>
    </form>
  );
}
