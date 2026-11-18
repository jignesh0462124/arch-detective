import { useIsFetching } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/** Decorative placeholder: its enclosing status supplies a single accessible label. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("data-skeleton block rounded-md", className)} />;
}

export function LoadingRows({
  label = "Loading saved results…",
  rows = 3,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div role="status" aria-busy="true" className="divide-y divide-border">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="space-y-3 px-5 py-5" aria-hidden="true">
          <Skeleton className={index % 2 ? "h-4 w-2/3" : "h-4 w-3/4"} />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Only observed, first-load page reads; health checks and silent refreshes do not flash. */
export function PageDataActivity() {
  const pending = useIsFetching({
    predicate: (query) =>
      query.getObserversCount() > 0 &&
      query.state.data === undefined &&
      !String(query.queryKey[0]).startsWith("advisor-capabilities") &&
      query.queryKey[0] !== "backend-health",
  });
  return (
    <div
      className="page-data-activity"
      data-loading={pending > 0}
      role="status"
      aria-label={pending > 0 ? "Loading page data" : undefined}
    >
      {pending > 0 && (
        <>
          <span className="sr-only">Loading page data…</span>
          <span className="page-data-activity-fill" aria-hidden="true" />
        </>
      )}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-5" data-testid="dashboard-loading">
      <span className="sr-only">Loading your saved audit data…</span>
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6" aria-hidden="true">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="mt-5 h-8 w-3/4 max-w-lg" />
        <Skeleton className="mt-4 h-3 w-48" />
        <Skeleton className="mt-5 h-4 w-2/3 max-w-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-12" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card" aria-hidden="true">
        <div className="space-y-3 border-b border-border p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-3 border-b border-border p-5 last:border-b-0">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card p-5" aria-hidden="true">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-5 h-10 w-full" />
      </div>
    </div>
  );
}
