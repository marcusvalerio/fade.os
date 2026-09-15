export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Carregando">
      <div className="space-y-2">
        <div className="h-7 w-44 rounded-sm bg-muted/20" />
        <div className="h-4 w-72 max-w-full rounded-sm bg-muted/15" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-md bg-muted/10" />
        ))}
      </div>
      <div className="h-56 rounded-md bg-muted/10" />
    </div>
  );
}
