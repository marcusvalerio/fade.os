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

/**
 * Os identificadores possíveis, do mais legível para o mais técnico.
 *
 * A ordem importa: a função pública é mais informativa do que quatro dígitos
 * de telefone, que por sua vez são mais discretos do que um e-mail inteiro.
 */
const ESTRATEGIAS: ((pessoa: Pessoa) => string | null)[] = [
  (p) => (p.role_title ? normalizarNome(p.role_title) || null : null),
  (p) => (p.phone ? finalDoTelefone(p.phone) : null),
  (p) => p.email ?? null,
];

function chaveDoNome(nome: string): string {
  return normalizarNome(nome).toLowerCase();
}

function rotular(pessoa: Pessoa, extra: string | null): string {
  return extra ? `${pessoa.name} · ${extra}` : pessoa.name;
}

/**
 * Devolve `{ id, name }` com o nome já pronto para exibir: acrescido de um
 * identificador quando outra pessoa da lista tem o mesmo nome.
 *
 * A escolha do identificador é por GRUPO de homônimos, não por pessoa. A
 * primeira versão desta função escolhia por pessoa, sempre na mesma ordem, e
 * com isso dois "Anderson Vilaça" que fossem ambos "Barbeiro" recebiam o
 * mesmo sufixo e continuavam idênticos — o problema que a função existe para
 * resolver sobrevivia justamente no caso mais provável, o de dois colegas com
 * a mesma função. Agora cada estratégia é testada no grupo inteiro e só é
 * aceita se realmente separar todo mundo; senão passa para a próxima.
 */
export function rotularHomonimos<T extends Pessoa>(pessoas: T[]): { id: string; name: string }[] {
  const grupos = new Map<string, T[]>();
  for (const p of pessoas) {
    const chave = chaveDoNome(p.name);
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(p);
    else grupos.set(chave, [p]);
  }

  const rotulos = new Map<string, string>();
  for (const grupo of grupos.values()) {
    // Nome único: fica limpo. Mostrar o telefone de todo mundo seria expor
    // dado sem necessidade e poluir a lista.
    if (grupo.length < 2) {
      rotulos.set(grupo[0].id, grupo[0].name);
      continue;
    }

    const vencedora =
      ESTRATEGIAS.find((estrategia) => {
        // A comparação é pela mesma chave que detectou a colisão. Comparar o
        // texto cru diria que "  Ana  Paula " e "ana paula" já são diferentes
        // — e a estratégia passaria sem ter separado ninguém.
        const nomes = grupo.map((p) => chaveDoNome(rotular(p, estrategia(p))));
        return new Set(nomes).size === grupo.length;
      }) ??
      // Nenhuma separa todo mundo (dois cadastros realmente iguais, por
      // exemplo). Usa-se a primeira que ao menos diga alguma coisa, em vez de
      // devolver dois rótulos idênticos calados.
      ESTRATEGIAS.find((estrategia) => grupo.some((p) => estrategia(p)));

    for (const p of grupo) rotulos.set(p.id, rotular(p, vencedora ? vencedora(p) : null));
  }

  return pessoas.map((p) => ({ id: p.id, name: rotulos.get(p.id) ?? p.name }));
}
