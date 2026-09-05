import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-sm bg-surface-muted animate-pulse motion-reduce:animate-none",
        className
      )}
    />
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="rounded-md border border-border bg-surface divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
