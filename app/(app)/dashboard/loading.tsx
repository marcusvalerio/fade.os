/** Enquanto o Início carrega: a forma da tela, sem números falsos. */
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando o Início" className="space-y-6">
      <div className="h-4 w-64 max-w-full bg-surface-muted animate-pulse motion-reduce:animate-none" />
      <div className="h-11 w-96 max-w-full bg-surface-muted animate-pulse motion-reduce:animate-none" />
      <div className="h-20 border-y border-border animate-pulse motion-reduce:animate-none" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="painel h-72 lg:col-span-7 animate-pulse motion-reduce:animate-none" />
        <div className="painel h-72 lg:col-span-5 animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}
