/**
 * CNPJ ou CPF da empresa. Quem ainda não tem CNPJ (profissional autônomo)
 * usa o CPF — o campo aceita os dois e decide pelo tamanho.
 *
 * CNPJ: desde julho de 2026 a Receita emite também o CNPJ alfanumérico
 * (12 caracteres [0-9A-Z] + 2 dígitos verificadores). O cálculo é o mesmo
 * módulo 11, com o valor de cada caractere = código ASCII − 48 — para
 * dígitos isso dá o próprio dígito, então CNPJ numérico e alfanumérico
 * passam pela mesma conta.
 */
export type Documento =
  | { tipo: "cpf"; valor: string; formatado: string }
  | { tipo: "cnpj"; valor: string; formatado: string };

export type ResultadoDocumento = { ok: true; documento: Documento | null } | { ok: false; erro: string };

function limpar(bruto: string): string {
  return (bruto ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

function cnpjValido(d: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(d) || /^(.)\1{13}$/.test(d)) return false;
  const valor = (c: string) => c.charCodeAt(0) - 48;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < n; i++) soma += valor(d[i]) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

export function formatarDocumento(doc: Documento["valor"]): string {
  if (doc.length === 11) return `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`;
  return `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
}

/** Vazio é permitido (o campo é opcional); preenchido precisa ser CPF ou CNPJ válido. */
export function validarDocumento(bruto: string | null | undefined): ResultadoDocumento {
  const d = limpar(bruto ?? "");
  if (!d) return { ok: true, documento: null };
  if (d.length === 11 && /^\d+$/.test(d)) {
    return cpfValido(d)
      ? { ok: true, documento: { tipo: "cpf", valor: d, formatado: formatarDocumento(d) } }
      : { ok: false, erro: "CPF inválido. Confira os 11 números." };
  }
  if (d.length === 14) {
    return cnpjValido(d)
      ? { ok: true, documento: { tipo: "cnpj", valor: d, formatado: formatarDocumento(d) } }
      : { ok: false, erro: "CNPJ inválido. Confira os 14 caracteres." };
  }
  return { ok: false, erro: "Informe um CNPJ (14 caracteres) ou, se ainda não tiver, o CPF (11 números)." };
}
