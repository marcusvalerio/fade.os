"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { BotaoDeAcao } from "@/components/ui/botao-de-acao";
import { Aviso } from "@/components/ui/estado";
import { Formulario, GrupoDeCampos, AcoesDoFormulario } from "@/components/ui/formulario";
import type { ProductFormState } from "@/actions/produtos";

/**
 * O formulário de produto, um só para criar e editar.
 *
 * Os campos estão agrupados por pergunta, não por tipo de dado: "o que é"
 * separado de "quanto custa e por quanto sai" separado de "quando avisar que
 * está acabando". Antes eram seis campos seguidos, e custo e preço de venda
 * ficavam visualmente no mesmo nível do estoque mínimo — três decisões
 * diferentes com o mesmo peso.
 */
type Valores = {
  name?: string;
  category?: string | null;
  cost_price?: number | string | null;
  sale_price?: number | string | null;
  minimum_stock?: number | string | null;
  current_stock?: number | string | null;
};

export function ProductForm({
  action,
  companyId,
  unidades,
  valores,
  modo,
}: {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  companyId?: string;
  /** Só aparece como escolha quando existe mais de uma. */
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
      {/* Uma unidade só não é uma decisão — vai escondida. */}
      {unidades?.length === 1 && <input type="hidden" name="unit_id" value={unidades[0].id} />}

      {state.error && (
        <div className="px-5 pt-5 sm:px-6">
          <Aviso tom="erro" titulo="Não foi possível salvar">
            {state.error}
          </Aviso>
        </div>
      )}

      <GrupoDeCampos titulo="O produto">
        <Field name="name" label="Nome" required>
          <Input id="name" name="name" defaultValue={val("name", v.name)} required autoFocus={modo === "novo"} />
        </Field>
        <Field name="category" label="Categoria" helper="Opcional — ajuda a achar na lista quando o catálogo cresce.">
          <Input id="category" name="category" defaultValue={val("category", v.category)} placeholder="Ex.: cabelo, barba, bebidas" />
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

      <GrupoDeCampos titulo="Preço" descricao="O que você paga e o que o cliente paga. A diferença é a sua margem.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field name="cost_price" label="Custo (R$)">
            <Input id="cost_price" name="cost_price" type="number" step="0.01" min={0} inputMode="decimal" defaultValue={val("cost_price", v.cost_price ?? 0)} />
          </Field>
          <Field name="sale_price" label="Preço de venda (R$)" required>
            <Input id="sale_price" name="sale_price" type="number" step="0.01" min={0} inputMode="decimal" required defaultValue={val("sale_price", v.sale_price)} />
          </Field>
        </div>
      </GrupoDeCampos>

      <GrupoDeCampos
        titulo="Estoque"
        descricao="O mínimo é o ponto em que o produto passa a aparecer como crítico no Início."
      >
        {modo === "novo" && (
          <Field name="current_stock" label="Quantidade inicial">
            <Input
              id="current_stock"
              name="current_stock"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={val("current_stock", v.current_stock ?? 0)}
            />
          </Field>
        )}
        <Field name="minimum_stock" label="Estoque mínimo">
          <Input
            id="minimum_stock"
            name="minimum_stock"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={val("minimum_stock", v.minimum_stock ?? 0)}
          />
        </Field>
      </GrupoDeCampos>

      <AcoesDoFormulario ajuda={modo === "novo" ? "Depois de salvo, já pode ser vendido no PDV." : undefined}>
        <Link href="/produtos" className={buttonClasses({ variant: "ghost" })}>
          Cancelar
        </Link>
        <BotaoDeAcao
          rotuloPendente="Salvando…"
          rotuloConcluido={modo === "novo" ? "Produto criado" : "Alterações salvas"}
        >
          {modo === "novo" ? "Salvar produto" : "Salvar alterações"}
        </BotaoDeAcao>
      </AcoesDoFormulario>
    </Formulario>
  );
}
