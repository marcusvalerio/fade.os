import "./landing.css";
import { Nav, Hero, Manifesto, Celular, Gestao, PorQue, ProvaSocial, Perguntas, ChamadaFinal, Rodape } from "./sections";
import { Historia } from "./Historia";
import { RevealObserver } from "./RevealObserver";

/**
 * Landing pública do CORTEX.OS.
 *
 * Uma história só, contada pelo próprio produto: o horário que o cliente
 * marca vira atendimento, o atendimento vira venda, a venda fecha o caixa.
 * Cada seção avança essa história (ideia → operação → celular → gestão →
 * por que → dúvidas → entrada) em vez de listar módulos lado a lado.
 *
 * Server Components do começo ao fim. Três ilhas client, todas pequenas:
 * RevealObserver (entrada ao rolar), StoryScroller (estado do palco da
 * seção "A operação") e DemoButton (o <dialog> com o filme do produto).
 * Todas as telas são reconstruções das páginas reais (ver screens.tsx),
 * com dados de exemplo.
 */
export function Landing() {
  return (
    <div className="lp light">
      <a href="#conteudo" className="lp-skip">
        Pular para o conteúdo
      </a>
      <Nav />
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Hero />
        <Manifesto />
        <Historia />
        <Celular />
        <Gestao />
        <PorQue />
        <ProvaSocial />
        <Perguntas />
        <ChamadaFinal />
      </main>
      <Rodape />
      <RevealObserver />
    </div>
  );
}
