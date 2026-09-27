import Link from "next/link";
import { ToastProvider } from "@/components/ui/toast";
import { Wordmark } from "@/components/ui/wordmark";

export default async function PublicBarbershopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <ToastProvider>
      {/*
        P1.10: a página pública é da barbearia, não do CORTEX — o cliente
        que está agendando um horário nunca escolhe tema. `.light` já
        existe em app/globals.css como o registro claro completo; aplicá-lo
        aqui redeclara as variáveis mais perto do conteúdo do que qualquer
        classe dark/light que o next-themes tenha posto em <html>, então o
        sistema/preferência do visitante nunca vaza para cá.
      */}
      <div className="light min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="shell flex items-center justify-between py-3.5">
            {/* Wordmark compartilhada (R19): a superfície pública
                reimplementava a tipografia da marca à mão, com o nome
                antigo do produto. */}
            <Link href={`/${slug}`}>
              <Wordmark tamanho="sm" />
            </Link>
            {/* Área do cliente: entrar ou, com sessão, os próprios horários. */}
            <Link
              href={`/${slug}/entrar`}
              className="alvo-toque text-body-sm text-muted hover:text-foreground transition-colors duration-fast ease-standard"
            >
              Meus horários
            </Link>
          </div>
        </header>
        <main>{children}</main>
        <PublicFooter />
      </div>
    </ToastProvider>
  );
}

/**
 * P1.11: CORTEX é infraestrutura, não protagonista desta página — o link
 * fica pequeno, no rodapé, e leva para a landing do produto, nunca para
 * dentro do app operacional.
 */
function PublicFooter() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="shell py-6 flex justify-center">
        <a
          href="/"
          className="text-caption text-muted hover:text-foreground transition-colors duration-fast ease-standard"
        >
          Feito com CORTEX.OS
        </a>
      </div>
    </footer>
  );
}
