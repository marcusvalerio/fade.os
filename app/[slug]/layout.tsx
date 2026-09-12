import Link from "next/link";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/ui/wordmark";

export default async function PublicBarbershopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="shell flex items-center justify-between py-3.5">
            {/* Wordmark compartilhada (R19): a superfície pública
                reimplementava a tipografia da marca à mão, com o nome
                antigo do produto. */}
            <Link href={`/${slug}`}>
              <Wordmark tamanho="sm" />
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main>{children}</main>
      </div>
    </ToastProvider>
  );
}
