import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 animate-rise-in">
      <div>
        <h1 className="text-page-title text-foreground">{title}</h1>
        {description && <p className="text-body-sm text-muted mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}
