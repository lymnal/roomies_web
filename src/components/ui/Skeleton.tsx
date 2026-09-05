// src/components/ui/Skeleton.tsx
import { cn } from '@/lib/utils';

export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-700/60', className)} aria-hidden="true" />;
}

export function SkeletonList({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" aria-busy="true">
      <Skeleton className="mb-4 h-4 w-1/3" />
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  );
}
