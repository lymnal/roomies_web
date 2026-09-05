// src/components/ui/Toast.tsx
// Lightweight toast notifications: `const toast = useToast(); toast.success('Expense added')`.
'use client';

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { HiOutlineCheckCircle, HiOutlineExclamationTriangle, HiOutlineInformationCircle, HiOutlineXMark } from 'react-icons/hi2';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

export interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

const ICONS: Record<ToastKind, ReactNode> = {
  success: <HiOutlineCheckCircle className="h-5 w-5 text-emerald-500" />,
  error: <HiOutlineExclamationTriangle className="h-5 w-5 text-rose-500" />,
  info: <HiOutlineInformationCircle className="h-5 w-5 text-sky-500" />,
};

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, item.kind === 'error' ? 7000 : 4000);
    return () => clearTimeout(timer);
  }, [item, onDismiss]);

  return (
    <div
      role={item.kind === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-pop animate-slide-up dark:border-slate-700 dark:bg-slate-800"
    >
      <span className="mt-0.5 flex-shrink-0">{ICONS[item.kind]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
        {item.description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>}
      </div>
      <button type="button" onClick={onDismiss} className="-m-1 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Dismiss">
        <HiOutlineXMark className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((kind: ToastKind, title: string, description?: string) => {
    counter.current += 1;
    const id = counter.current;
    setItems((prev) => [...prev.slice(-3), { id, kind, title, description }]);
  }, []);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((item) => item.id !== id)), []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      info: (title, description) => push('info', title, description),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className={cn(
          'pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-96 lg:bottom-6'
        )}
        aria-live="polite"
      >
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used within a ToastProvider');
  return api;
}
