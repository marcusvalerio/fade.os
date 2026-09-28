"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyManager } from "@/lib/permissions";
import { friendlyMessage } from "@/lib/errors";
import { getSessionUser } from "@/lib/tenancy";
import { notificarGestores } from "@/lib/notificacoes/servidor";
import { avaliarLote, existentesDe, LIMITE_DE_LINHAS, type Campo } from "@/lib/importacao/clientes";
import type { ActionResult } from "@/actions/onboarding";

async function clientesDaEmpresa(companyId: string) {
  const supabase = await createClient();
  const todos: { name: string | null; phone: string | null; email: string | null }[] = [];
  // Página a página: o PostgREST limita o tamanho de cada resposta.
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from("client")
      .select("name, phone, email")
      .eq("company_id", companyId)
      .range(de, de + 999);
    if (error) throw error;
    todos.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return todos;
}

/** Telefones (só dígitos), e-mails e nomes já cadastrados — para a prévia marcar duplicados. */
export async function contatosCadastrados(
  companyId: string
): Promise<ActionResult<{ telefones: string[]; emails: string[]; nomes: string[] }>> {
  try {
    await requireCompanyManager(companyId);
    const e = existentesDe(await clientesDaEmpresa(companyId));
    return { ok: true, data: { telefones: [...e.telefones], emails: [...e.emails], nomes: [...(e.nomes ?? [])] } };
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }
}

const campo = z.string().max(2000).optional();
const loteSchema = z
  .array(
    z.object({
      linha: z.number().int().min(1),
      valores: z.object({
        name: campo,
        sobrenome: campo,
        phone: campo,
        email: campo,
        birth_date: campo,
        notes: campo,
        consent: campo,
      }),
    })
  )
  .min(1)
  .max(LIMITE_DE_LINHAS);

export type RelatorioDeImportacao = {
  criados: number;
  jaCadastrados: number;
  repetidos: number;
  invalidos: { linha: number; motivo: string }[];
  comAviso: number;
};

/**
 * Grava a importação. Reavalia tudo aqui — a prévia do navegador é só uma
 * prévia — e compara de novo com o que está cadastrado agora, porque alguém
 * pode ter cadastrado um cliente entre a prévia e a confirmação.
 */
export async function importarClientes(
  companyId: string,
  itens: { linha: number; valores: Partial<Record<Campo, string>> }[]
): Promise<ActionResult<RelatorioDeImportacao>> {
  const parsed = loteSchema.safeParse(itens);
  if (!z.string().uuid().safeParse(companyId).success || !parsed.success) {
    return { ok: false, error: `Arquivo inválido ou com mais de ${LIMITE_DE_LINHAS} linhas.` };
  }
  try {
    await requireCompanyManager(companyId);
    const avaliadas = avaliarLote(parsed.data, existentesDe(await clientesDaEmpresa(companyId)));
    const novos = avaliadas.filter((a) => a.situacao === "nova").map((a) => ({ ...a.cliente!, company_id: companyId }));

    const supabase = await createClient();
    for (let i = 0; i < novos.length; i += 500) {
      const { error } = await supabase.from("client").insert(novos.slice(i, i + 500));
      if (error) {
        return {
          ok: false,
          error: i === 0 ? friendlyMessage(error) : `Parou no meio: ${i} clientes foram criados, os demais não. ${friendlyMessage(error)}`,
        };
      }
    }

    revalidatePath("/clientes");
    // Quem importou já vê o relatório; o resto da gerência recebe o aviso.
    if (novos.length > 0) {
      const autor = (await getSessionUser())?.id ?? null;
      const n = novos.length;
      after(() =>
        notificarGestores(
          companyId,
          {
            tipo: "clientes.importacao",
            titulo: "Clientes importados",
            corpo: `${n} ${n === 1 ? "cliente entrou" : "clientes entraram"} pela importação de planilha.`,
            url: "/clientes",
            chave: `clientes.importacao:${companyId}:${Date.now()}`,
          },
          autor
        )
      );
    }
    return {
      ok: true,
      data: {
        criados: novos.length,
        jaCadastrados: avaliadas.filter((a) => a.situacao === "ja_cadastrada").length,
        repetidos: avaliadas.filter((a) => a.situacao === "duplicada_no_arquivo").length,
        invalidos: avaliadas.filter((a) => a.situacao === "invalida").map((a) => ({ linha: a.linha, motivo: a.motivo ?? "Inválida" })),
        comAviso: avaliadas.filter((a) => a.situacao === "nova" && a.avisos.length > 0).length,
      },
    };
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }
}
