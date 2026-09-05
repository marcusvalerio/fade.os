import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center animate-fade-in">
      <p className="text-section-title text-foreground">{title}</p>
      <p className="text-body-sm text-muted mt-1.5 max-w-sm mx-auto">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
