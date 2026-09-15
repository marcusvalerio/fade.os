export default function AppLoading() {
  return (
    <div className="min-h-[calc(100vh-5rem)] animate-pulse" aria-label="Carregando">
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-sm bg-muted/20" />
          <div className="h-4 w-64 max-w-full rounded-sm bg-muted/15" />
        </div>
        <div className="h-px w-full bg-border" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-28 rounded-md bg-muted/10" />
          <div className="h-28 rounded-md bg-muted/10" />
          <div className="h-28 rounded-md bg-muted/10" />
        </div>
        <div className="h-64 rounded-md bg-muted/10" />
      </div>
    </div>
  );
}
