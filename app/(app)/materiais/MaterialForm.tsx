"use client";

import Link from "next/link";
import { Field, Input, Select } from "@/components/ui/field";
import { BotaoDeAcao } from "@/components/ui/botao-de-acao";
import { Aviso } from "@/components/ui/estado";
import { useFormularioComEco } from "@/lib/enviar-sem-limpar";
import type { ConsumableFormState } from "@/actions/materiais";

type Valores = {
  name?: string;
  category?: string | null;
  unit_of_measure?: string | null;
  cost_price?: number | string | null;
  minimum_stock?: number | string | null;
};

/**
 * O formulário de material de consumo, um só para criar e editar.
 *
 * Era um form de Server Component com a Server Action direto no `action`: o
 * erro subia como exceção e a página inteira caía na error boundary — um nome
 * de uma letra apagava tudo o que tinha sido digitado. Agora segue o mesmo
 * caminho dos outros cadastros: o erro volta para a tela, o que foi digitado
 * fica, e só o sucesso navega para a lista.
 */
export function MaterialForm({
  action,
  modo,
  companyId,
  unidades,
  valores,
  estoqueAtual,
}: {
  action: (state: ConsumableFormState, formData: FormData) => Promise<ConsumableFormState>;
  modo: "novo" | "editar";
  companyId?: string;
  /** Só aparece como escolha quando existe mais de uma. */
  unidades?: { id: string; name: string }[];
  valores?: Valores;
  /** Só leitura na edição: estoque se move por movimentação registrada. */
  estoqueAtual?: number;
}) {
  const { estado, aoEnviar, eco } = useFormularioComEco(action, "materiais");
  const v = valores ?? {};

  return (
    <form onSubmit={aoEnviar} className="rounded-md border border-border bg-surface p-6 space-y-4">
      {companyId && <input type="hidden" name="company_id" value={companyId} />}
      {unidades?.length === 1 && <input type="hidden" name="unit_id" value={unidades[0].id} />}

      {estado.error && (
        <Aviso tom="erro" titulo="Não foi possível salvar">
          {estado.error}
        </Aviso>
      )}

      <Field name="name" label="Nome" required>
        <Input
          id="name"
          name="name"
          defaultValue={eco.texto("name", v.name)}
          required
          autoFocus={modo === "novo"}
          placeholder={modo === "novo" ? "Ex.: Lâmina descartável" : undefined}
        />
      </Field>
      <Field name="category" label="Categoria">
        <Input id="category" name="category" defaultValue={eco.texto("category", v.category)} />
      </Field>
      {unidades && unidades.length > 1 && (
        <Field name="unit_id" label="Unidade" required>
          <Select id="unit_id" name="unit_id" required defaultValue={eco.opcao("unit_id")}>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field name="unit_of_measure" label="Unidade de medida" helper={modo === "novo" ? "un, ml, g..." : undefined}>
          <Input id="unit_of_measure" name="unit_of_measure" defaultValue={eco.texto("unit_of_measure", v.unit_of_measure ?? "un")} />
        </Field>
        <Field name="cost_price" label="Custo (R$)">
          <Input id="cost_price" name="cost_price" type="number" step="0.01" defaultValue={eco.texto("cost_price", v.cost_price ?? 0)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {modo === "novo" ? (
          <Field name="current_stock" label="Estoque inicial">
            <Input id="current_stock" name="current_stock" type="number" step="1" defaultValue={eco.texto("current_stock", 0)} />
          </Field>
        ) : (
          // Saldo é só leitura aqui: estoque se move por movimentação
          // registrada (Catálogo › Estoque), nunca por edição de cadastro —
          // senão some o rastro de quem tirou o quê e por quê.
          <div>
            <p className="text-label uppercase text-muted">Estoque atual</p>
            <p className="text-body text-foreground tabular-nums">{estoqueAtual}</p>
            <Link href="/estoque" className="text-caption text-signal hover:underline">
              Movimentar estoque
            </Link>
          </div>
        )}
        <Field name="minimum_stock" label="Estoque mínimo">
          <Input id="minimum_stock" name="minimum_stock" type="number" step="1" defaultValue={eco.texto("minimum_stock", v.minimum_stock ?? 0)} />
        </Field>
      </div>
      <BotaoDeAcao rotuloPendente="Salvando…" falhou={Boolean(estado.error)} className="w-full">
        {modo === "novo" ? "Salvar" : "Salvar alterações"}
      </BotaoDeAcao>
    </form>
  );
}
