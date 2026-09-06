import { SkeletonRows } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <div className="h-7 w-32 rounded-sm bg-surface-muted animate-pulse mb-6" />
      <SkeletonRows />
    </div>
  );
}
