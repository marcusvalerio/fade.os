import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-md" />
        ))}
      </div>
      <SkeletonRows />
    </div>
  );
}
