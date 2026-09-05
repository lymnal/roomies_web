// src/components/ui/Alert.tsx
import type { ReactNode } from 'react';

interface AlertProps {
  kind?: 'error' | 'success' | 'info' | 'warning';
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const STYLES: Record<NonNullable<AlertProps['kind']>, string> = {
  error: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800',
  success: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800',
  info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800',
};

export default function Alert({ kind = 'info', children, onDismiss, className = '' }: AlertProps) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-md border p-3 text-sm ${STYLES[kind]} ${className}`}>
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-current opacity-60 hover:opacity-100" aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
