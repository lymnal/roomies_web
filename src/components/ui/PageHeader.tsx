// src/components/ui/PageHeader.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, description, eyebrow, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">{eyebrow}</p>}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
