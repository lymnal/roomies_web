// src/components/ui/Card.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  noPadding?: boolean;
}

export default function Card({ children, title, description, actions, footer, className = '', headerClassName = '', bodyClassName = '', footerClassName = '', noPadding = false }: CardProps) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900', className)}>
      {(title || actions) && (
        <header className={cn('flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800', headerClassName)}>
          <div className="min-w-0">
            {typeof title === 'string' ? <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3> : title}
            {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!noPadding && 'p-5', bodyClassName)}>{children}</div>
      {footer && <footer className={cn('border-t border-slate-200 px-5 py-3 dark:border-slate-800', footerClassName)}>{footer}</footer>}
    </section>
  );
}
