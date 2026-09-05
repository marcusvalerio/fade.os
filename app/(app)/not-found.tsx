import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="max-w-md mx-auto text-center py-16 animate-rise-in">
      <p className="text-section-title text-foreground">Não encontramos esse registro.</p>
      <p className="text-body-sm text-muted mt-1.5">
        Ele pode ter sido removido, ou o link não é mais válido.
      </p>
      <Link href="/agenda" className={buttonClasses({ className: "mt-6" })}>
        Voltar para a agenda
      </Link>
    </div>
  );
}
