import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCompany } from "@/lib/current-company";
import { requireAuthenticatedUser } from "@/lib/tenancy";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/ui/wordmark";
import { Twist } from "@/components/textures/twist";

/**
 * Primeiro acesso (redesenho nov/2026): depois de criar a senha, a pessoa cai
 * aqui uma vez — "Boas-vindas, Rafael! Agora você faz parte da Barber House."
 * É um momento de comemoração, com a textura da marca; um botão leva ao dia
 * dela. Quem pediu menos movimento vê a textura parada (o componente cuida).
 */
export const metadata = { title: "Boas-vindas · CORTEX.OS", robots: { index: false } };

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default async function BoasVindasPage() {
  const atual = await getCurrentCompany();
  if (!atual) redirect("/");
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data: profissional } = await supabase
    .from("professional")
    .select("name, avatar_url")
    .eq("user_id", user.id)
    .eq("company_id", atual.company.id)
    .maybeSingle();

  const empresa = atual.company as { name: string; logo_url?: string | null };
  const nomeCompleto = profissional?.name ?? "";
  const primeiroNome = nomeCompleto.split(/\s+/)[0] || "";
  const ehProfissional = !!profissional;

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-neutral-ink text-on-ink">
      <div aria-hidden className="absolute inset-0 -z-10">
        <Twist tokens={{ "--texture-ink": "#1F5BFF", "--texture-field": "#06080D" }} />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 55% at 50% 50%, rgba(6,8,13,.94) 30%, rgba(6,8,13,.5) 72%, rgba(6,8,13,.15) 100%)" }}
      />

      <div className="px-6 pt-6 sm:px-10">
        <Wordmark tamanho="sm" />
      </div>

      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-xl flex-col items-center justify-center px-6 pb-16 text-center animate-rise-in">
        <div
          className="grid size-20 place-items-center overflow-hidden rounded-[22px] bg-neutral-warm-white font-heading text-[1.875rem] font-bold text-neutral-ink"
          style={{ boxShadow: "0 0 0 8px rgba(31,91,255,.25), 0 30px 80px -10px rgba(31,91,255,.6)" }}
        >
          {empresa.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo_url} alt="" className="size-full object-cover" />
          ) : (
            iniciais(empresa.name)
          )}
        </div>
        <p className="mt-7 text-caption font-bold uppercase tracking-[0.16em] text-info-ink">Primeiro acesso</p>
        <h1 className="mt-3 font-heading text-[clamp(3.25rem,10vw,7rem)] font-bold leading-[0.9] tracking-tight">
          Boas-vindas{primeiroNome ? "," : ""}
          <br />
          {primeiroNome ? `${primeiroNome}!` : "à equipe!"}
        </h1>
        <p className="mt-5 max-w-md text-body text-on-ink-soft">
          Agora você faz parte da <strong className="text-on-ink">{empresa.name}</strong>.{" "}
          {ehProfissional
            ? "Sua agenda, seus clientes e sua comissão moram aqui."
            : "A operação da barbearia inteira mora aqui."}
        </p>
        <Link
          href={ehProfissional ? "/agenda" : "/dashboard"}
          className="mt-9 inline-flex min-h-14 items-center rounded-md bg-neutral-warm-white px-8 text-body font-bold text-neutral-ink"
        >
          {ehProfissional ? "Ver minha agenda" : "Começar"}
        </Link>
        <p className="mt-5 text-caption text-on-ink-muted">
          Entre sempre pelo navegador do celular ou do computador, com o seu acesso.
        </p>
      </div>
    </main>
  );
}
