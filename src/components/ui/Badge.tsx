// src/components/ui/Badge.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  purple: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export default function Badge({ children, tone = 'neutral', size = 'sm', dot = false, className = '' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        TONES[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
