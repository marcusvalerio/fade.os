import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-7 w-40 mb-6" />
      <SkeletonRows />
    </div>
  );
}
