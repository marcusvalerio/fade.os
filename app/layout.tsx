import type { Metadata, Viewport } from "next";
import { Sora, Instrument_Sans } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "@/components/theme-provider";
import { ValidacaoEmPortugues } from "@/components/validacao-em-portugues";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-logo-sora",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FADE OS",
  description: "Sistema operacional para barbearias e estúdios de beleza",
};

/**
 * Sem maximum-scale nem user-scalable: impedir zoom quebra a acessibilidade
 * de quem precisa aproximar, e o iOS ignora essa restrição desde a versão 10
 * de qualquer forma. O jeito certo de evitar o zoom automático no foco é o
 * input ter font-size >= 16px, que é o que --text-input garante.
 *
 * viewportFit cover é o que habilita env(safe-area-inset-*), usado pelo
 * painel de navegação e pelos modais para não terminar atrás do indicador de
 * home do iPhone.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Era fixo em Onyx, então a barra do navegador continuava escura com a
  // interface clara. Segue a preferência do sistema, que é o que esta meta
  // consegue expressar.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5F0" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${sora.variable} ${instrumentSans.variable} ${GeistSans.variable}`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {/* Traduz o balão de validação do navegador. Fica na raiz porque
              vale para toda tela com formulário, inclusive a página pública. */}
          <ValidacaoEmPortugues />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
