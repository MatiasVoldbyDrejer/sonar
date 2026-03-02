import { cn } from "@/lib/utils";

export function SkeletonShimmer({ className }: { className?: string }) {
  return (
    <div className={cn("shimmer rounded-md bg-muted", className)} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="space-y-2">
        <SkeletonShimmer className="h-12 w-64" />
        <SkeletonShimmer className="h-5 w-40" />
        <SkeletonShimmer className="h-4 w-56" />
      </div>
      {/* Table rows */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonShimmer key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export function PulseSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-5 space-y-4">
      <SkeletonShimmer className="h-4 w-3/4" />
      <div className="space-y-3">
        <SkeletonShimmer className="h-20 w-full rounded-lg" />
        <SkeletonShimmer className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function InstrumentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonShimmer className="h-4 w-20" />
        <SkeletonShimmer className="h-8 w-72" />
        <SkeletonShimmer className="h-4 w-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonShimmer className="h-48" />
        <SkeletonShimmer className="h-48" />
      </div>
      <SkeletonShimmer className="h-[400px]" />
    </div>
  );
}
