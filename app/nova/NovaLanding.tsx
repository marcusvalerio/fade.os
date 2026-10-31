import "../_landing/landing.css";
import "./nova.css";
import { Nav, Sistema, Celular, Diferenciais, Perguntas, ChamadaFinal, Rodape } from "../_landing/sections";
import { Historia } from "../_landing/Historia";
import { RevealObserver } from "../_landing/RevealObserver";
import { HeroCorte } from "./HeroCorte";
import { AntesDepois } from "./AntesDepois";

/**
 * Rascunho (/nova): o topo deixa de explicar e passa a mostrar. Um toque em
 * "Fechar atendimento" acende, em sequência, os cinco lugares que o
 * fechamento real escreve (close_attendance). Logo abaixo, o antes/depois
 * que a pessoa arrasta com o dedo. O resto é a landing atual.
 */
export function NovaLanding() {
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
        <Perguntas />
        <ChamadaFinal />
      </main>
      <Rodape />
      <RevealObserver />
    </div>
  );
}
