import { z } from "zod";

/**
 * As regras do catálogo, num lugar só.
 *
 * Estes números têm uma gêmea no banco, em `public.catalog_limits()`, e os
 * triggers de service/product/consumable/professional são a autoridade final.
 * O que vive aqui existe para a tela recusar antes, com uma frase em
 * português, em vez de deixar a pessoa preencher tudo e levar um erro no fim.
 *
 * Se um limite mudar, muda nos dois lugares — e o teste em `catalogo.test.ts`
 * falha se eles se separarem em espírito.
 */
export const CATALOGO = {
  nomeMin: 2,
  nomeMax: 80,
  /** Pessoas têm nomes mais longos; é o mesmo teto do agendamento público. */
  nomePessoaMax: 120,
  duracaoMin: 1,
  /**
   * 8 horas. O motor gera horários dentro da janela de UM dia de
   * funcionamento, então um serviço que não cabe num turno nunca produz slot.
   * O serviço mais longo da NORTE 21 tem 70 min — este teto existe para
   * barrar o erro de digitação, não para limitar o produto.
   */
  duracaoMax: 480,
  comissaoMin: 0,
  /** Acima de 100% a casa pagaria ao profissional mais do que recebeu. */
  comissaoMax: 100,
} as const;

/**
 * Tira o espaço das pontas e junta o espaço repetido do meio, para que
 * "Pomada", " Pomada " e "Pomada  " parem de ser três coisas diferentes.
 */
export function normalizarNome(valor: unknown): string {
  return String(valor ?? "").trim().replace(/\s+/g, " ");
}

/** Nome de item de catálogo: normalizado, nem vazio nem gigante. */
export const nomeCatalogoSchema = z
  .string()
  .transform(normalizarNome)
  .pipe(
    z
      .string()
      .min(CATALOGO.nomeMin, "Informe um nome com pelo menos 2 caracteres.")
      .max(CATALOGO.nomeMax, `O nome pode ter no máximo ${CATALOGO.nomeMax} caracteres.`)
  );

/** Nome de pessoa: mesma normalização, teto maior. */
export const nomePessoaSchema = z
  .string()
  .transform(normalizarNome)
  .pipe(
    z
      .string()
      .min(CATALOGO.nomeMin, "Informe um nome com pelo menos 2 caracteres.")
      .max(CATALOGO.nomePessoaMax, `O nome pode ter no máximo ${CATALOGO.nomePessoaMax} caracteres.`)
  );

/** Campo de texto opcional: string vazia e só-espaços viram ausência. */
export const textoOpcionalSchema = z
  .string()
  .optional()
  .transform((v) => normalizarNome(v) || undefined);

/**
 * Preço de catálogo. Zero não é permitido: cortesia já tem semântica própria
 * (o item do atendimento nasce como `courtesy`, com autorização e motivo), e
 * um item de R$ 0,00 produz um atendimento que a interface não fecha e uma
 * venda que o banco recusa por falta de pagamento.
 */
export const precoSchema = z.coerce
  .number({ invalid_type_error: "Informe um valor válido." })
  .positive("O preço precisa ser maior que zero.");

/** Custo pode ser zero — brinde, amostra, item recebido sem cobrança. */
export const custoSchema = z.coerce
  .number({ invalid_type_error: "Informe um valor válido." })
  .min(0, "O custo não pode ser negativo.");

export const duracaoSchema = z.coerce
  .number({ invalid_type_error: "Informe a duração em minutos." })
  .int("A duração precisa ser um número inteiro de minutos.")
  .min(CATALOGO.duracaoMin, "A duração precisa ser de pelo menos 1 minuto.")
  .max(CATALOGO.duracaoMax, `A duração não pode passar de ${CATALOGO.duracaoMax} minutos.`);

/** Comissão é opcional; quando informada, precisa fazer sentido. */
export const comissaoOpcionalSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v === "" || v === null || v === undefined ? undefined : v))
  .pipe(
    z.coerce
      .number({ invalid_type_error: "Informe uma comissão válida." })
      .min(CATALOGO.comissaoMin, "A comissão não pode ser negativa.")
      .max(CATALOGO.comissaoMax, "A comissão não pode passar de 100%.")
      .optional()
  );
