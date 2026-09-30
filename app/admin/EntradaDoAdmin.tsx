import type { ReactNode } from "react";
import Link from "next/link";

/**
 * A moldura das telas de ENTRADA do CORTEX ADMIN (login, recuperação e nova
 * senha). Fundo ônix e o selo "Plataforma": deixa claro, antes de digitar
 * qualquer coisa, que isto não é o login da barbearia.
 */
export function EntradaDoAdmin({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string;
  descricao?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <main className="admin-console min-h-screen bg-neutral-ink text-[var(--neutral-bone)] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md animate-rise-in">
        <div className="mb-8">
          <Link href="/" className="text-caption text-white/55 hover:text-white transition-colors">
            CORTEX.OS
          </Link>
          <p className="mt-8 flex items-center gap-2 text-label uppercase tracking-label text-white/45">
            <span aria-hidden className="size-1.5 bg-[#70D2FF]" />
            Plataforma · Admin
          </p>
          <h1 className="mt-2 font-heading text-3xl sm:text-4xl tracking-tight">{titulo}</h1>
          {descricao && <div className="mt-3 text-body-sm text-white/60 max-w-sm">{descricao}</div>}
        </div>
        {children}
        {rodape && <div className="mt-6 text-caption text-white/40">{rodape}</div>}
      </div>
    </main>
  );
}

/** Aviso dentro da entrada: mesmo fundo escuro, tom pela borda à esquerda. */
export function AvisoDaEntrada({ tom, children }: { tom: "erro" | "info" | "sucesso"; children: ReactNode }) {
  const borda = tom === "erro" ? "border-l-[#FF7A5E]" : tom === "sucesso" ? "border-l-[#8FC29C]" : "border-l-[#70D2FF]";
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={`mb-5 rounded-sm border border-white/10 border-l-2 ${borda} bg-white/[0.04] px-4 py-3 text-body-sm text-white/80`}>
      {children}
    </div>
  );
}
