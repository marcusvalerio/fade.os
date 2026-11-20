import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/ui/wordmark";

/**
 * Política de Privacidade (LGPD). Texto do doc "CORTEX.OS — Política de
 * Privacidade" (nov/2026). ANTES DE PUBLICAR: preencher os campos entre
 * colchetes e validar com advogado — ver a seção de pendências no doc e
 * docs/proximas-atualizacoes/README.md.
 */
export const metadata: Metadata = {
  title: "Política de Privacidade · CORTEX.OS",
  description: "Como o CORTEX.OS trata dados pessoais, com base na LGPD.",
};

const ATUALIZADA_EM = "20 de novembro de 2026";

type Linha = string[];
function Tabela({ cab, linhas }: { cab: string[]; linhas: Linha[] }) {
  return (
    <div className="my-5 overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-body-sm">
        <thead>
          <tr>{cab.map((c) => <th key={c} className="border-b border-border-strong py-2 pr-4 text-left font-semibold">{c}</th>)}</tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i}>{l.map((c, j) => <td key={j} className="border-b border-border py-2.5 pr-4 align-top text-muted">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-heading text-section-title text-foreground">{titulo}</h2>
      <div className="mt-3 space-y-3 text-body text-muted">{children}</div>
    </section>
  );
}

export default function PrivacidadePage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <Link href="/" aria-label="CORTEX.OS — início" className="inline-flex text-foreground">
          <Wordmark tamanho="sm" />
        </Link>
        <h1 className="mt-10 font-heading text-page-title text-foreground">Política de Privacidade</h1>
        <p className="mt-2 text-caption text-muted">Última atualização: {ATUALIZADA_EM}</p>

        <Secao titulo="1. Quem somos e a quem esta política se aplica">
          <p>O CORTEX.OS é um sistema de gestão para barbearias, oferecido por [RESPONSÁVEL], [CPF OU CNPJ], com endereço em [ENDEREÇO] (“CORTEX”, “nós”).</p>
          <Tabela
            cab={["Quem você é", "O que faz no CORTEX", "Nosso papel na LGPD"]}
            linhas={[
              ["Visitante do site", "Navega no site e pode falar com a gente", "Controlador"],
              ["Dono ou gerente da barbearia", "Contrata e administra a conta", "Controlador dos dados da conta e da cobrança"],
              ["Profissional da equipe", "Entra com identificador e senha da barbearia", "Operador, em nome da barbearia"],
              ["Cliente da barbearia", "Agenda pela página da barbearia", "Operador, em nome da barbearia"],
            ]}
          />
          <p>Quando somos operador, a barbearia é a controladora: ela decide quais dados do cliente e da equipe guarda e para quê. Tratamos esses dados só para o sistema funcionar para ela (art. 39 da LGPD).</p>
        </Secao>

        <Secao titulo="2. Quais dados tratamos">
          <p>Coletamos só o necessário. Não tratamos dados sensíveis e não vendemos dados.</p>
          <Tabela
            cab={["Grupo", "Dados"]}
            linhas={[
              ["Visitante do site", "Páginas vistas, origem (domínio e utm), tipo de aparelho e navegador; identificador aleatório só se você aceitar. Não guardamos IP."],
              ["Quem fala com a gente", "Nome, nome da barbearia, e-mail, telefone, cidade"],
              ["Dono ou gerente", "Nome, e-mail, senha (cifrada), dados da barbearia, dados de cobrança"],
              ["Profissional da equipe", "Nome, identificador, foto (opcional), função, jornada, serviços, comissões e atendimentos"],
              ["Cliente da barbearia", "Nome, telefone, e-mail, nascimento (opcional), agendamentos, atendimentos, valores, avaliações, observações e se aceita contato"],
              ["Todos", "Registros de acesso e de ações; aparelho autorizado a receber avisos"],
            ]}
          />
          <p>Dados de cartão são digitados direto no processador de pagamento. O CORTEX não vê nem guarda o número do cartão.</p>
        </Secao>

        <Secao titulo="3. Para que usamos e com qual base legal">
          <Tabela
            cab={["Para quê", "Base legal (art. 7º da LGPD)"]}
            linhas={[
              ["Conta, cobrança e suporte", "Execução de contrato"],
              ["Fazer o sistema funcionar para a barbearia", "Execução de contrato, em nome da barbearia"],
              ["Confirmações, lembretes e avisos do sistema", "Execução de contrato; aviso no aparelho só com sua permissão"],
              ["Clientes para chamar e mensagens de retorno", "Consentimento do cliente (“aceita contato”)"],
              ["Medição do site com identificador", "Consentimento"],
              ["Medição sem identificar ninguém e melhoria do produto", "Legítimo interesse"],
              ["Segurança e registros de acesso", "Legítimo interesse e obrigação legal (Marco Civil, art. 15)"],
              ["Registros fiscais", "Obrigação legal"],
            ]}
          />
        </Secao>

        <Secao titulo="4. Cookies e medição do site">
          <p>Medição própria, sem Google Analytics e sem anúncios. O cookie <code>cortex-analytics</code> guarda só a sua escolha (13 meses). O identificador de visitante só existe se você aceitar. Se recusar, ou se o navegador enviar Global Privacy Control ou Do Not Track, contamos a visita sem identificar você.</p>
        </Secao>

        <Secao titulo="5. Com quem compartilhamos">
          <Tabela
            cab={["Empresa", "Para quê"]}
            linhas={[["Supabase", "Banco de dados, login e arquivos"], ["Vercel", "Hospedagem"], ["Google Firebase", "Avisos no celular e no navegador"], ["Sentry", "Registro de erros técnicos"], ["Stripe", "Pagamento dos planos"]]}
          />
          <p>Parte desses serviços guarda dados fora do Brasil, com as garantias do art. 33 da LGPD. Dentro da barbearia, cada pessoa vê só o que o papel dela permite, e uma barbearia nunca vê os dados de outra.</p>
        </Secao>

        <Secao titulo="6. Por quanto tempo guardamos">
          <Tabela
            cab={["Dado", "Prazo"]}
            linhas={[["Dados da barbearia (inclui clientes e equipe)", "Enquanto o contrato durar + [90] dias para exportar"], ["Registros de acesso", "6 meses"], ["Registros fiscais", "5 anos"], ["Eventos de medição do site", "180 dias"], ["Sessões e identificador de visitante", "13 meses"]]}
          />
        </Secao>

        <Secao titulo="7. Como protegemos">
          <p>Separação por barbearia em todas as tabelas, acesso por papel, senhas cifradas, HTTPS, chaves só no servidor e registro das ações importantes. Em caso de incidente com risco relevante, avisamos a ANPD e as pessoas afetadas (art. 48).</p>
        </Secao>

        <Secao titulo="8. Seus direitos">
          <p>Você pode pedir, de graça: confirmação e acesso, correção, anonimização ou eliminação, portabilidade, saber com quem compartilhamos, revogar o consentimento e revisão de decisão automatizada (art. 18).</p>
          <p>Cliente ou profissional de uma barbearia: fale primeiro com a barbearia. Cliente com conta: veja e edite seus dados em “Minha conta”. Demais casos: [E-MAIL DE CONTATO]. Respondemos em até 15 dias.</p>
        </Secao>

        <Secao titulo="9. Crianças e adolescentes">
          <p>A barbearia pode cadastrar um cliente menor de idade com o consentimento de um dos pais ou responsável (art. 14). Menores de 18 anos não devem criar conta própria.</p>
        </Secao>

        <Secao titulo="10. Contato e ANPD">
          <p>Encarregado: [NOME], [E-MAIL DE CONTATO]. Você também pode reclamar à ANPD em <a className="underline" href="https://www.gov.br/anpd">gov.br/anpd</a>.</p>
        </Secao>

        <Secao titulo="11. Mudanças">
          <p>Quando esta política mudar, atualizamos a data no topo. Mudança importante é avisada antes de valer.</p>
        </Secao>
      </div>
    </main>
  );
}
