"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAccess, requireAllBelongToCompany } from "@/lib/tenancy";
import { friendlyMessage } from "@/lib/errors";
import type { ActionResult } from "@/actions/onboarding";

/**
 * PDV — venda avulsa de produto, sem atendimento. Usa o mesmo núcleo
 * comercial da Fase 4 via create_pdv_sale() (supabase/migrations/
 * 20260909100000_provadefogo1_pdv.sql): mesma tabela sale/sale_item, mesmo
 * estoque, mesmo caixa, mesmo financeiro — não é uma segunda venda.
 * cancel_sale() (já existente) cancela vendas de PDV sem nenhuma alteração,
 * porque já trabalha genericamente por sale_item.
 */

/**
 * Sem `unit_price`: o preço da venda é product.sale_price, lido pelo banco
 * dentro de create_pdv_sale. Aceitar um preço vindo do navegador — mesmo que
 * a função SQL o ignore — deixaria no contrato um campo que parece
 * autoritativo e não é.
 */
const itemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  discount: z.coerce.number().min(0).default(0),
});

const createPdvSaleSchema = z.object({
  company_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  items: z.array(itemSchema).min(1, "Adicione ao menos um produto"),
  discount_amount: z.coerce.number().min(0).default(0),
  surcharge_amount: z.coerce.number().min(0).default(0),
  payments: z
    .array(
      z.object({
        method: z.enum(["cash", "pix", "debit", "credit", "credit_installments"]),
        amount: z.coerce.number().positive(),
      })
    )
    .default([]),
  authorization_code: z.string().trim().min(1).optional(),
});

export async function createPdvSale(
  input: z.infer<typeof createPdvSaleSchema>
): Promise<ActionResult<{ saleId: string }>> {
  const parsed = createPdvSaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await requireCompanyAccess(parsed.data.company_id);
    await requireAllBelongToCompany("unit", [parsed.data.unit_id], parsed.data.company_id);
    if (parsed.data.client_id) {
      await requireAllBelongToCompany("client", [parsed.data.client_id], parsed.data.company_id);
    }
  } catch (error) {
    return { ok: false, error: friendlyMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_pdv_sale", {
      p_company_id: parsed.data.company_id,
      p_unit_id: parsed.data.unit_id,
      p_client_id: parsed.data.client_id ?? null,
      p_items: parsed.data.items,
      p_discount_amount: parsed.data.discount_amount,
      p_surcharge_amount: parsed.data.surcharge_amount,
      p_payments: parsed.data.payments,
      p_authorization_code: parsed.data.authorization_code ?? null,
    })
    .single();

  if (error || !data) return { ok: false, error: friendlyMessage(error) };

  revalidatePath("/pdv");
  revalidatePath("/vendas");
  revalidatePath("/caixa");
  revalidatePath("/estoque");
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  return { ok: true, data: { saleId: data as string } };
}
