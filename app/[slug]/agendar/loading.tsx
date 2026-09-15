export default function BookingLoading() {
  return (
    <div className="shell max-w-xl py-8 sm:py-12" aria-label="Carregando agendamento" role="status">
      <div className="h-4 w-40 rounded-sm bg-muted/20 animate-pulse mb-2" />
      <div className="h-10 w-64 max-w-full rounded-sm bg-muted/20 animate-pulse mb-8" />
      <div className="space-y-3">
        <div className="h-20 rounded-md bg-muted/10 animate-pulse" />
        <div className="h-20 rounded-md bg-muted/10 animate-pulse" />
        <div className="h-20 rounded-md bg-muted/10 animate-pulse" />
      </div>
    </div>
  );
}
