// src/components/ui/Segmented.tsx
// Horizontal filter control (scrolls on narrow screens).
'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}

export default function Segmented<T extends string>({ options, value, onChange, size = 'md', className = '', ariaLabel }: SegmentedProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-shrink-0 items-center gap-1.5 rounded-lg font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            )}
          >
            {option.icon}
            {option.label}
            {typeof option.count === 'number' && (
              <span className={cn('rounded-full px-1.5 text-[11px]', active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300')}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
