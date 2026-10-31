import "./landing.css";
import "./nova.css";
import { Nav, Sistema, Celular, Diferenciais, ProvaSocial, Perguntas, ChamadaFinal, Rodape } from "./sections";
import { Historia } from "./Historia";
import { RevealObserver } from "./RevealObserver";
import { HeroCorte } from "./HeroCorte";
import { AntesDepois } from "./AntesDepois";

/**
 * Landing pública do CORTEX.OS.
 *
 * Uma ideia só — um corte, tudo resolvido — contada pelo próprio produto,
 * na ordem em que alguém decide: impacto (HeroCorte: um toque acende os cinco
 * lugares que o fechamento escreve) → contraste (AntesDepois) → entendimento e o
 * momento "isso é diferente" (O sistema: um fechamento escrito em seis
 * lugares) → demonstração (um dia no balcão) → desejo (o celular de quem
 * atende) → diferenciação (o que só um sistema faz, cada item com a tela
 * funcionando) → confiança (perguntas) → conversão (a marca se monta com o
 * mesmo gesto da entrada no produto, e o pedido de acesso).
 *
 * Server Components por padrão. Ilhas client pequenas e isoladas:
 * RevealObserver, StoryScroller, Pulso, CelularTour, Papeis, EmCena e
 * DemoButton. Todo movimento é CSS (landing.css) sobre transform/opacity/
 * clip-path; as ilhas só trocam atributos. Todas as telas são reconstruções
 * das páginas reais (screens.tsx), com dados de exemplo.
 */
export function Landing() {
  return (
    <div className="lp light">
      <a href="#conteudo" className="lp-skip">
        Pular para o conteúdo
      </a>
      <Nav />
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <HeroCorte />
        <AntesDepois />
        <Sistema />
        <Historia />
        <Celular />
        <Diferenciais />
        <ProvaSocial />
        <Perguntas />
        <ChamadaFinal />
      </main>
      <Rodape />
      <RevealObserver />
    </div>
  );
}
