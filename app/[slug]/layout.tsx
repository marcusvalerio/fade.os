import Link from "next/link";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/theme-toggle";

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
            <Link
              href={`/${slug}`}
              className="font-logo font-[777] text-base tracking-tight text-foreground"
            >
              FADE OS
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main>{children}</main>
      </div>
    </ToastProvider>
  );
}
