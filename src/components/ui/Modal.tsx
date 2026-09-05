// src/components/ui/Modal.tsx
// Bottom sheet on phones, centred dialog on larger screens. Closes on Escape and backdrop click.
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineXMark } from 'react-icons/hi2';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Set false while a request is in flight so the dialog cannot be dismissed. */
  dismissible?: boolean;
}

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

export default function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, dismissible]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-[2px]" onClick={dismissible ? onClose : undefined} />
      <div
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop animate-slide-up sm:rounded-2xl sm:animate-scale-in dark:bg-slate-900',
          SIZES[size]
        )}
      >
        {(title || dismissible) && (
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <div className="min-w-0">
              {title && <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                className="-mr-1.5 -mt-1.5 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close"
              >
                <HiOutlineXMark className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
