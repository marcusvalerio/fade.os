import { Twist } from "@/components/textures/twist";

// Página de teste da textura Twist. Não entra no menu nem no sitemap.
export const metadata = { title: "Textura Twist · teste", robots: { index: false } };

export default function TexturaPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0B", color: "#F4F4F5", padding: 40, display: "grid", gap: 32 }}>
      <section style={{ position: "relative", height: 480, borderRadius: 16, overflow: "hidden" }}>
        <Twist tokens={{ "--texture-ink": "#3366FF", "--texture-field": "#0A0A0B" }} />
      </section>

      <section
        style={{ position: "relative", maxWidth: 720, height: 180, borderRadius: 16, overflow: "hidden", border: "1px solid #222226" }}
      >
        <Twist tokens={{ "--texture-ink": "#1C2A55", "--texture-field": "#0F1426" }} />
        <div style={{ position: "absolute", inset: 0, padding: 24, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 6, pointerEvents: "none" }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#8FAEFF" }}>Novidade</span>
          <strong style={{ fontSize: 22 }}>Exemplo de aviso de novidade</strong>
          <span style={{ color: "#A1A1AA" }}>Texto de exemplo: a caixa reage ao mouse; no celular, mexe sozinha.</span>
        </div>
      </section>
    </main>
  );
}
