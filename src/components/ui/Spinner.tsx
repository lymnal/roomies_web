// src/components/ui/Spinner.tsx
import { cn } from '@/lib/utils';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<SpinnerSize, string> = {
  xs: 'h-4 w-4 border-2',
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-10 w-10 border-[3px]',
};

export default function Spinner({ size = 'md', className = '' }: { size?: SpinnerSize; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('animate-spin rounded-full border-current border-t-transparent text-brand-600 dark:text-brand-400', SIZES[size], className)}
    />
  );
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
      <Spinner size="lg" />
      {label && <p>{label}</p>}
    </div>
  );
}
