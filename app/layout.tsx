import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
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
 * A tipografia do CORTEX — a mesma na landing, no produto, na área do
 * cliente e no Admin, servida do próprio domínio (sem CDN de terceiros):
 *
 *   Familjen Grotesk  títulos — a voz de manchete, apertada
 *   Supreme           subtítulos e rótulos editoriais
 *   Sora              interface e texto corrido
 *   Panchang          só a marca (wordmark)
 *   Geist Mono        só onde o dado é técnico (Admin: ids, horários de log)
 *
 * Todas variáveis (eixo wght); os arquivos são o subconjunto latino, que
 * cobre o português inteiro.
 */
const familjen = localFont({
  src: "./fonts/FamiljenGrotesk-Variable.woff2",
  variable: "--font-familjen",
  weight: "400 700",
  display: "swap",
});

const supreme = localFont({
  src: "./fonts/Supreme-Variable.woff2",
  variable: "--font-supreme",
  weight: "100 800",
  display: "swap",
});

const sora = localFont({
  src: "./fonts/Sora-Variable.woff2",
  variable: "--font-sora",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CORTEX.OS",
  description: "O sistema operacional da barbearia: agenda, atendimento, caixa, comissão, estoque e clientes no mesmo sistema.",
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
      className={`${panchang.variable} ${familjen.variable} ${supreme.variable} ${sora.variable} ${GeistMono.variable}`}
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
