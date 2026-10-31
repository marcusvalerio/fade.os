import { ImageResponse } from "next/og";

/**
 * Imagem de compartilhamento (WhatsApp, Instagram, LinkedIn) da landing.
 * Cores da marca: fundo ink, texto warm-white, o quadrado azul entre
 * CORTEX e OS. Sem tela de produto inventada — só a marca e a frase do Hero.
 */
export const alt = "CORTEX.OS — Cada corte move a barbearia inteira.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#041723",
          color: "#F6F2F1",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", fontSize: 40, fontWeight: 700, letterSpacing: 2 }}>
          <span>CORTEX</span>
          <span style={{ width: 10, height: 10, background: "#0093D6", margin: "0 6px 10px" }} />
          <span>OS</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 900 }}>
            Cada corte move a barbearia inteira.
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: "rgba(232,230,221,0.62)" }}>
            Agenda, atendimento, clientes, comissão e caixa no mesmo registro.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
