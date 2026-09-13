import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "@/components/theme-provider";
import { ValidacaoEmPortugues } from "@/components/validacao-em-portugues";
import "./globals.css";

/*
 * Panchang, da Indian Type Foundry, é a fonte da marca — a real, servida do
 * próprio domínio e não de CDN de terceiros. O arquivo é a versão VARIÁVEL
 * (eixo wght 200–800): a estática que a Fontshare entrega para @700 vem com
 * a tabela de nomes higienizada e se declara "Semi-bold", então usar a
 * variável e fixar 700 é o que garante o peso certo.
 *
 * Sem substituto: nenhuma condensada, nenhuma "parecida". A construção da
 * Panchang é o que a torna reconhecível, e é justamente por isso que ela está
 * aqui.
 */
const panchang = localFont({
  src: "./fonts/Panchang-Variable.woff2",
  variable: "--font-panchang",
  weight: "200 800",
  display: "swap",
});

/*
 * Supreme, também da Indian Type Foundry / Fontshare — mesma licença e mesmo
 * critério de auto-hospedagem da Panchang. R22: com Panchang recuada para
 * assinatura exclusiva, a interface precisava de uma voz editorial própria
 * entre a marca e a Geist operacional. Supreme cobre exatamente esse meio —
 * títulos, números que importam, momentos — sem competir com a Panchang.
 */
const supreme = localFont({
  src: "./fonts/Supreme-Variable.woff2",
  variable: "--font-supreme",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CORTEX.OS",
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
  // R23.6: os dois hex aqui eram sobra de uma paleta anterior à Color
  // System 3.0 (nem tan nem preto fazem parte da identidade atual) — a
  // barra do navegador pintava uma cor que não existe mais em lugar nenhum
  // do produto. O shell (header + sidebar) é sempre Creeping Depth,
  // independente do tema do conteúdo, então essa é a cor que representa o
  // produto nos dois registros — não há "versão clara" do shell para
  // seguir aqui.
  themeColor: "#041723",
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
      className={`${panchang.variable} ${supreme.variable} ${GeistSans.variable}`}
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
