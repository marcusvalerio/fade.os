import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-7 w-40 mb-6" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-md" />
        ))}
      </div>
      <SkeletonRows />
    </div>
  );
}
