import { normalizarNome } from "./catalogo.ts";

/**
 * Rótulos que distinguem homônimos — e só quando precisa.
 *
 * Dois clientes podem se chamar "Anderson Vilaça": isso é legítimo e continua
 * permitido (nada de UNIQUE em nome). O problema era operacional — nas listas
 * de seleção os dois apareciam idênticos, e quem escolhia não tinha como
 * saber qual era qual. Numa rodada de QA isso me fez desativar o profissional
 * errado.
 *
 * A desambiguação é condicional de propósito: mostrar o telefone de todo mundo
 * seria expor dado sem necessidade e poluir a lista. O identificador secundário
 * aparece só nos nomes que se repetem.
 */
type Pessoa = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  role_title?: string | null;
};

/** Últimos dígitos, o suficiente para diferenciar sem expor o número inteiro. */
function finalDoTelefone(phone: string): string | null {
  const digitos = phone.replace(/\D/g, "");
  return digitos.length >= 4 ? `final ${digitos.slice(-4)}` : null;
}

function discriminador(pessoa: Pessoa): string | null {
  if (pessoa.role_title) return normalizarNome(pessoa.role_title) || null;
  if (pessoa.phone) return finalDoTelefone(pessoa.phone);
  if (pessoa.email) return pessoa.email;
  return null;
}

/**
 * Devolve `{ id, name }` com o nome já pronto para exibir: acrescido de um
 * identificador quando outra pessoa da lista tem o mesmo nome.
 */
export function rotularHomonimos<T extends Pessoa>(pessoas: T[]): { id: string; name: string }[] {
  const contagem = new Map<string, number>();
  for (const p of pessoas) {
    const chave = normalizarNome(p.name).toLowerCase();
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  return pessoas.map((p) => {
    const chave = normalizarNome(p.name).toLowerCase();
    if ((contagem.get(chave) ?? 0) < 2) return { id: p.id, name: p.name };

    const extra = discriminador(p);
    return { id: p.id, name: extra ? `${p.name} · ${extra}` : p.name };
  });
}
