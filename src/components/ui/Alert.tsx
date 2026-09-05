// src/components/ui/Alert.tsx
import type { ReactNode } from 'react';
import { HiOutlineCheckCircle, HiOutlineExclamationTriangle, HiOutlineInformationCircle, HiOutlineXCircle, HiOutlineXMark } from 'react-icons/hi2';
import { cn } from '@/lib/utils';

interface AlertProps {
  kind?: 'error' | 'success' | 'info' | 'warning';
  title?: ReactNode;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const STYLES: Record<NonNullable<AlertProps['kind']>, { box: string; icon: ReactNode }> = {
  error: {
    box: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
    icon: <HiOutlineXCircle className="h-5 w-5 text-rose-500" />,
  },
  success: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
    icon: <HiOutlineCheckCircle className="h-5 w-5 text-emerald-500" />,
  },
  info: {
    box: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
    icon: <HiOutlineInformationCircle className="h-5 w-5 text-sky-500" />,
  },
  warning: {
    box: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    icon: <HiOutlineExclamationTriangle className="h-5 w-5 text-amber-500" />,
  },
};

export default function Alert({ kind = 'info', title, children, onDismiss, className = '' }: AlertProps) {
  const style = STYLES[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-xl border p-3.5 text-sm', style.box, className)}>
      <span className="mt-0.5 flex-shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="-m-1 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100" aria-label="Dismiss">
          <HiOutlineXMark className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
