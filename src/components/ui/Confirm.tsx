// src/components/ui/Confirm.tsx
// Promise-based confirmation dialog: `const ok = await confirm({ title: 'Delete?' })`.
'use client';

import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { HiOutlineExclamationTriangle, HiOutlineQuestionMarkCircle } from 'react-icons/hi2';
import Button from './Button';
import Modal from './Modal';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => new Promise<boolean>((resolve) => setPending({ options, resolve })), []);

  const settle = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  const value = useMemo(() => confirm, [confirm]);
  const tone = pending?.options.tone ?? 'primary';

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal open={pending !== null} onClose={() => settle(false)} size="sm">
        {pending && (
          <div className="flex flex-col items-center gap-4 pt-2 text-center sm:flex-row sm:items-start sm:text-left">
            <div
              className={
                tone === 'danger'
                  ? 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300'
                  : 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300'
              }
            >
              {tone === 'danger' ? <HiOutlineExclamationTriangle className="h-6 w-6" /> : <HiOutlineQuestionMarkCircle className="h-6 w-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{pending.options.title}</h2>
              {pending.options.description && <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{pending.options.description}</div>}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => settle(false)}>
                  {pending.options.cancelLabel ?? 'Cancel'}
                </Button>
                <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={() => settle(true)} autoFocus>
                  {pending.options.confirmLabel ?? 'Confirm'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used within a ConfirmProvider');
  return confirm;
}
