"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarPiloto } from "@/actions/pilotos";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Novo piloto para qualquer empresa (a Norte 21 foi o primeiro). Começa
 * hoje ou depois; o Dia 0 (véspera) é a base de comparação.
 */
export function NovoPiloto({ empresas, hoje }: { empresas: { id: string; name: string }[]; hoje: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) {
    return (
      <Button variant="secondary" onClick={() => setAberto(true)}>
        Novo piloto
      </Button>
    );
  }

  return (
    <form
      className="painel p-5 space-y-4 max-w-2xl"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setOcupado(true);
        setErro(null);
        const r = await criarPiloto({
          empresa: String(f.get("empresa") ?? ""),
          nome: String(f.get("nome") ?? ""),
          inicio: String(f.get("inicio") ?? ""),
          dias: Number(f.get("dias") ?? 14),
          objetivo: String(f.get("objetivo") ?? ""),
        });
        setOcupado(false);
        if (!r.ok) return setErro(r.error);
        show("Piloto criado.", "success");
        router.push(`/admin/pilotos/${r.data.id}`);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="empresa" label="Empresa" required>
          <Select name="empresa" required defaultValue="">
            <option value="" disabled>
              Escolha…
            </option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field name="nome" label="Nome" required>
          <Input name="nome" required minLength={3} maxLength={90} placeholder="Piloto Norte 21" />
        </Field>
        <Field name="inicio" label="Início (Dia 1)" required helper="O Dia 0 é a véspera.">
          <Input name="inicio" type="date" required min={hoje} defaultValue={hoje} />
        </Field>
        <Field name="dias" label="Duração (dias)" required>
          <Input name="dias" type="number" required min={1} max={90} defaultValue={14} />
        </Field>
      </div>
      <Field name="objetivo" label="Objetivo (opcional)">
        <Textarea name="objetivo" rows={2} maxLength={500} />
      </Field>
      {erro && (
        <p role="alert" className="text-body-sm text-danger-ink">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={ocupado}>
          {ocupado ? "Criando…" : "Criar piloto"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAberto(false)} disabled={ocupado}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
