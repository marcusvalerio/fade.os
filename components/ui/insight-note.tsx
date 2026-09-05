/**
 * A "inteligência" do FADE OS aparece assim: uma observação pontual e
 * contextual, nunca um badge de "IA" genérico. Yellow Ace é usado só aqui
 * (e em foco/estados especiais) — é a "luz" do produto, não uma cor de uso
 * comum.
 */
export function InsightNote({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-signal pl-3 py-0.5 animate-fade-in">
      <p className="text-label uppercase text-muted">{label}</p>
      <p className="text-body-sm text-foreground mt-0.5">{children}</p>
    </div>
  );
}
