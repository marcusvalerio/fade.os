import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";

/**
 * Carregamento de página do produto: a forma do que vem (título, faixa de
 * números, lista), no mesmo Skeleton que cada rota usa — uma linguagem só de
 * "está chegando", que respeita movimento reduzido.
 */
export default function AppLoading() {
  return (
    <div role="status" aria-label="Carregando" className="min-h-96">
      <Skeleton className="h-7 w-40 mb-2" />
      <Skeleton className="h-4 w-64 max-w-full mb-8" />
      <div className="grid gap-px grid-cols-2 sm:grid-cols-4 mb-8">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-none" />
        ))}
      </div>
      <SkeletonRows />
    </div>
  );
}
