"use client";

import { useActionState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { BotaoDeAcao } from "@/components/ui/botao-de-acao";
import { Aviso } from "@/components/ui/estado";
import { Formulario, GrupoDeCampos, AcoesDoFormulario } from "@/components/ui/formulario";
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

      {/* O erro no topo, e não no rodapé: era preciso rolar até o fim para
          descobrir por que o formulário não passou. */}
      {state.error && (
        <div className="px-5 pt-5 sm:px-6">
          <Aviso tom="erro" titulo="Não foi possível salvar">
            {state.error}
          </Aviso>
        </div>
      )}

      <GrupoDeCampos titulo="O serviço">
      <Field name="name" label="Nome" required>
        <Input
          id="name"
          name="name"
          defaultValue={val("name", v.name)}
          maxLength={CATALOGO.nomeMax}
          autoFocus={modo === "novo"}
        />
      </Field>

      <Field name="description" label="Descrição">
        <Textarea id="description" name="description" rows={2} defaultValue={val("description", v.description)} />
      </Field>

      <Field name="category" label="Categoria">
        <Input id="category" name="category" defaultValue={val("category", v.category)} maxLength={CATALOGO.nomeMax} />
      </Field>
      </GrupoDeCampos>

      <GrupoDeCampos
        titulo="Preço e tempo"
        descricao="A duração é o que reserva a cadeira na agenda — é ela que define quantos cabem no dia."
      >
      <Field name="default_price" label="Preço (R$)" required>
        <Input
          id="default_price"
          name="default_price"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={val("default_price", v.default_price?.toString())}
        />
      </Field>

      <Field name="planned_duration_minutes" label="Duração planejada (minutos)" required>
        <Input
          id="planned_duration_minutes"
          name="planned_duration_minutes"
          type="number"
          min={CATALOGO.duracaoMin}
          max={CATALOGO.duracaoMax}
          defaultValue={val("planned_duration_minutes", v.planned_duration_minutes?.toString())}
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
          defaultValue={val("default_commission_percent", v.default_commission_percent?.toString())}
        />
      </Field>

      </GrupoDeCampos>

      <GrupoDeCampos
        titulo="Onde aparece"
        descricao="Ativo e publicado são coisas diferentes: um serviço pode existir no balcão sem estar na vitrine."
      >
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

      </GrupoDeCampos>

      <AcoesDoFormulario
        ajuda={modo === "novo" ? "Depois de salvo, falta vincular quem executa." : undefined}
      >
        <Link href="/servicos" className={buttonClasses({ variant: "ghost" })}>
          Cancelar
        </Link>
        <BotaoDeAcao
          rotuloPendente="Salvando…"
          rotuloConcluido={modo === "novo" ? "Serviço criado" : "Alterações salvas"}
        >
          {modo === "novo" ? "Cadastrar serviço" : "Salvar alterações"}
        </BotaoDeAcao>
      </AcoesDoFormulario>
    </Formulario>
  );
}
