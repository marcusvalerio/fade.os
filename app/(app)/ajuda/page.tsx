import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { BotaoReverApresentacao } from "@/components/apresentacao";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Ajuda — CORTEX.OS" };

const CAMINHOS = [
  {
    area: "Agenda",
    href: "/agenda",
    texto: "Veja o dia ou a semana, filtre por profissional e marque só em horários que dá para reservar de verdade.",
  },
  {
    area: "Atendimento",
    href: "/atendimento",
    texto: "Comece pela agenda ou sem hora marcada. O fechamento grava venda, caixa, comissão e estoque de uma vez.",
  },
  {
    area: "Clientes",
    href: "/clientes",
    texto: "Ficha, histórico e quem passou do próprio ritmo de volta. Importe a base de outro sistema por planilha.",
  },
  { area: "Caixa", href: "/caixa", texto: "Abra o turno, acompanhe entradas e saídas, conte ao fechar e veja a diferença." },
  { area: "Nova venda", href: "/pdv", texto: "Venda de balcão: produto fora de um atendimento. O estoque baixa na hora." },
  { area: "Início", href: "/dashboard", texto: "O Pulso diz o que pede ação agora; abaixo, como o negócio está indo no período." },
];

const DUVIDAS = [
  {
    p: "“Dinheiro” não aparece como forma de pagamento.",
    r: "O caixa está fechado. Abra em Caixa. Se estiver aberto, confira se Dinheiro está ativo em Configurações → Financeiro.",
  },
  {
    p: "Não consigo dar desconto.",
    r: "Quem não é dono nem gerente precisa do código de autorização (Configurações → Atendimento).",
  },
  {
    p: "Não tem horário livre na página da barbearia.",
    r: "Confira o funcionamento da unidade, as jornadas, bloqueios e ausências da equipe, e se o serviço está marcado para aparecer na página pública.",
  },
  {
    p: "A contagem do caixa não bateu.",
    r: "O fechamento registra a falta ou a sobra. Escreva o motivo antes de confirmar — depois de fechado, o caixa não muda.",
  },
  {
    p: "O CORTEX manda mensagem para os meus clientes?",
    r: "Não. Os botões de WhatsApp abrem a conversa com a mensagem pronta; quem envia é você.",
  },
  {
    p: "O cliente tem login?",
    r: "Pode ter: na página da barbearia, “Meus horários” leva à conta do cliente (e-mail e senha ou Google). A equipe entra só com e-mail ou identificador e senha.",
  },
];

/** Ajuda: rever a apresentação, onde fica cada coisa e as dúvidas de balcão. */
export default function AjudaPage() {
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Ajuda"
        title="Como o CORTEX funciona."
        description="A apresentação de um minuto, o caminho de cada tarefa e as dúvidas que mais aparecem no balcão."
        action={<BotaoReverApresentacao className={buttonClasses()} />}
      />

      <section aria-labelledby="caminhos" className="mt-2">
        <h2 id="caminhos" className="text-section-title text-foreground">
          Onde fica cada coisa
        </h2>
        <ul className="mt-4 grid sm:grid-cols-2 gap-px bg-border border-y border-border">
          {CAMINHOS.map((c) => (
            <li key={c.href} className="bg-background">
              <Link href={c.href} className="group block h-full p-4">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-body-sm font-medium text-foreground">{c.area}</span>
                  <span aria-hidden className="text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-transform duration-micro">
                    →
                  </span>
                </span>
                <span className="block text-caption text-muted mt-1 max-w-[46ch]">{c.texto}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="duvidas" className="mt-12">
        <h2 id="duvidas" className="text-section-title text-foreground">
          Dúvidas frequentes
        </h2>
        <div className="mt-4 border-b border-border">
          {DUVIDAS.map((d) => (
            <details key={d.p} className="group border-t border-border">
              <summary className="flex items-start justify-between gap-6 py-4 cursor-pointer list-none">
                <span className="text-body-sm font-medium text-foreground">{d.p}</span>
                <span aria-hidden className="text-muted group-open:rotate-45 transition-transform duration-interacao">
                  +
                </span>
              </summary>
              <p className="text-body-sm text-muted pb-5 -mt-1 max-w-[60ch]">{d.r}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
