/**
 * Regras da importação de clientes — usadas na prévia (navegador) e de novo
 * no servidor antes de gravar (o servidor não confia na prévia).
 *
 * Princípios:
 * - nome é obrigatório; telefone, e-mail e nascimento inválidos não barram a
 *   linha, só são descartados com aviso (a pessoa entra, o dado ruim não);
 * - consentimento de contato só é "sim" quando a planilha diz sim — sem
 *   coluna, ninguém importado recebe mensagem (LGPD);
 * - duplicado = mesmo telefone ou mesmo e-mail, no arquivo ou já cadastrado.
 */
export type Campo = "name" | "sobrenome" | "phone" | "email" | "birth_date" | "notes" | "consent";

export const CAMPOS: { campo: Campo; rotulo: string; obrigatorio?: boolean }[] = [
  { campo: "name", rotulo: "Nome", obrigatorio: true },
  { campo: "sobrenome", rotulo: "Sobrenome" },
  { campo: "phone", rotulo: "Telefone / WhatsApp" },
  { campo: "email", rotulo: "E-mail" },
  { campo: "birth_date", rotulo: "Nascimento" },
  { campo: "notes", rotulo: "Observações" },
  { campo: "consent", rotulo: "Aceita contato" },
];

export const LIMITE_DE_LINHAS = 2000;

export type Mapeamento = Partial<Record<Campo, number>>;

export function normalizarCabecalho(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const PISTAS: [Campo, RegExp][] = [
  ["sobrenome", /^(sobrenome|ultimo nome|last name|surname)$/],
  ["name", /^(nome|nome completo|cliente|nome do cliente|name|full name|first name|primeiro nome)$/],
  ["phone", /(telefone|celular|whatsapp|whats|fone|phone|tel|contato)/],
  ["email", /(e ?mail|email|correio)/],
  ["birth_date", /(nascimento|aniversario|data de nasc|birth|niver|dt nasc)/],
  ["notes", /(observa|obs|nota|notes|comentario)/],
  ["consent", /(consent|aceita|autoriza|opt ?in|permite)/],
];

export function sugerirMapeamento(cabecalho: string[]): Mapeamento {
  const m: Mapeamento = {};
  cabecalho.forEach((h, i) => {
    const n = normalizarCabecalho(h);
    if (!n) return;
    // consentimento antes de telefone: "aceita contato whatsapp" é consentimento.
    const ordem: Campo[] = ["consent", "sobrenome", "name", "email", "birth_date", "notes", "phone"];
    for (const campo of ordem) {
      const re = PISTAS.find(([c]) => c === campo)![1];
      if (m[campo] === undefined && re.test(n)) {
        m[campo] = i;
        return;
      }
    }
  });
  return m;
}

export function digitosDoTelefone(bruto: string): string | null {
  let d = (bruto ?? "").replace(/\D/g, "");
  if (!d) return null;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === 10 || d.length === 11 ? d : null;
}

export function formatarTelefone(d: string): string {
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "dd/mm/aaaa", "dd-mm-aa", "aaaa-mm-dd" ou número de série do Excel. */
export function lerData(bruto: string, hoje = new Date()): string | null {
  const s = (bruto ?? "").trim();
  if (!s) return null;
  let a: number, m: number, d: number;
  let r: RegExpMatchArray | null;
  if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) {
    [d, m, a] = [Number(r[1]), Number(r[2]), Number(r[3])];
    if (r[3].length === 2) a += a > hoje.getFullYear() % 100 ? 1900 : 2000;
  } else if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    [a, m, d] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
  } else return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (a < 1900 || dt.getTime() > hoje.getTime()) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function lerConsentimento(bruto: string): boolean {
  return /^(s|sim|y|yes|x|1|true|verdadeiro|ok|aceita|autorizado|autoriza)$/.test(normalizarCabecalho(bruto ?? ""));
}

export type ClienteImportado = {
  name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  notes: string | null;
  communication_consent: boolean;
};

export type LinhaAvaliada = {
  linha: number; // número da linha na planilha (cabeçalho = 1)
  cliente: ClienteImportado | null;
  situacao: "nova" | "invalida" | "duplicada_no_arquivo" | "ja_cadastrada";
  motivo?: string;
  avisos: string[];
};

export type Existentes = { telefones: Set<string>; emails: Set<string>; nomes?: Set<string> };

/** Nome comparável: sem acento, caixa ou espaço sobrando. */
export function chaveDoNome(nome: string): string {
  return normalizarCabecalho(nome);
}

export function existentesDe(clientes: { name?: string | null; phone: string | null; email: string | null }[]): Existentes {
  const telefones = new Set<string>();
  const emails = new Set<string>();
  const nomes = new Set<string>();
  for (const c of clientes) {
    if (c.name) nomes.add(chaveDoNome(c.name));
    const t = c.phone ? digitosDoTelefone(c.phone) : null;
    if (t) telefones.add(t);
    if (c.email) emails.add(c.email.trim().toLowerCase());
  }
  return { telefones, emails, nomes };
}

/** Uma linha crua (já com as colunas escolhidas) → cliente validado. */
export function avaliarCliente(valores: Partial<Record<Campo, string>>): { cliente: ClienteImportado | null; motivo?: string; avisos: string[] } {
  const avisos: string[] = [];
  const nome = [valores.name, valores.sobrenome].map((v) => (v ?? "").trim()).filter(Boolean).join(" ").replace(/\s+/g, " ");
  if (nome.length < 2) return { cliente: null, motivo: "Sem nome", avisos };
  if (nome.length > 120) return { cliente: null, motivo: "Nome longo demais", avisos };

  const telBruto = (valores.phone ?? "").trim();
  const tel = digitosDoTelefone(telBruto);
  if (telBruto && !tel) avisos.push("Telefone inválido — ficou em branco");

  const emailBruto = (valores.email ?? "").trim().toLowerCase();
  const email = emailBruto && EMAIL.test(emailBruto) ? emailBruto : null;
  if (emailBruto && !email) avisos.push("E-mail inválido — ficou em branco");

  const nascBruto = (valores.birth_date ?? "").trim();
  const nasc = lerData(nascBruto);
  if (nascBruto && !nasc) avisos.push("Data de nascimento não reconhecida — ficou em branco");

  const notas = (valores.notes ?? "").trim().slice(0, 1000) || null;

  return {
    cliente: {
      name: nome,
      phone: tel ? formatarTelefone(tel) : null,
      email,
      birth_date: nasc,
      notes: notas,
      communication_consent: lerConsentimento(valores.consent ?? ""),
    },
    avisos,
  };
}

export function valoresDaLinha(linha: string[], mapa: Mapeamento): Partial<Record<Campo, string>> {
  const v: Partial<Record<Campo, string>> = {};
  for (const [campo, i] of Object.entries(mapa) as [Campo, number][]) {
    if (i !== undefined && i >= 0) v[campo] = linha[i] ?? "";
  }
  return v;
}

/** Avalia um lote inteiro, marcando duplicados no arquivo e já cadastrados. */
export function avaliarLote(
  itens: { linha: number; valores: Partial<Record<Campo, string>> }[],
  existentes: Existentes
): LinhaAvaliada[] {
  const vistosTel = new Set<string>();
  const vistosEmail = new Set<string>();
  const vistosNome = new Set<string>();
  return itens.map(({ linha, valores }) => {
    const { cliente, motivo, avisos } = avaliarCliente(valores);
    if (!cliente) return { linha, cliente: null, situacao: "invalida", motivo, avisos };
    const tel = cliente.phone ? digitosDoTelefone(cliente.phone) : null;
    const email = cliente.email;
    if ((tel && existentes.telefones.has(tel)) || (email && existentes.emails.has(email))) {
      return { linha, cliente, situacao: "ja_cadastrada", motivo: tel && existentes.telefones.has(tel) ? "Telefone já cadastrado" : "E-mail já cadastrado", avisos };
    }
    // Sem telefone nem e-mail, o nome é a única pista: mesmo nome = mesma pessoa.
    const nome = !tel && !email ? chaveDoNome(cliente.name) : null;
    if (nome && existentes.nomes?.has(nome)) {
      return { linha, cliente, situacao: "ja_cadastrada", motivo: "Nome já cadastrado", avisos };
    }
    if ((tel && vistosTel.has(tel)) || (email && vistosEmail.has(email)) || (nome && vistosNome.has(nome))) {
      return { linha, cliente, situacao: "duplicada_no_arquivo", motivo: "Repetido no arquivo", avisos };
    }
    if (tel) vistosTel.add(tel);
    if (email) vistosEmail.add(email);
    if (nome) vistosNome.add(nome);
    return { linha, cliente, situacao: "nova", avisos };
  });
}
