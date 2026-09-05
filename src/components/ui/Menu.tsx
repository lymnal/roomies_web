// src/components/ui/Menu.tsx
// Small dropdown menu. Closes on outside click and Escape.
'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface MenuItem {
  label: ReactNode;
  onSelect?: () => void;
  href?: string;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Renders a thin separator above this item. */
  separator?: boolean;
  /** Shown as selected (checkmark style) */
  active?: boolean;
}

interface MenuProps {
  /** Rendered as the trigger; receives whether the menu is open. */
  trigger: (state: { open: boolean }) => ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  /** Anchor the panel above the trigger (for menus at the bottom of the screen). */
  placement?: 'bottom' | 'top';
  className?: string;
  ariaLabel?: string;
}

export default function Menu({ trigger, items, align = 'right', placement = 'bottom', className, ariaLabel }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <div onClick={() => setOpen((o) => !o)} role="button" aria-haspopup="menu" aria-expanded={open} aria-label={ariaLabel} className="flex cursor-pointer">
        {trigger({ open })}
      </div>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-40 min-w-[12rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop animate-scale-in dark:border-slate-700 dark:bg-slate-800',
            align === 'right' ? 'right-0' : 'left-0',
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          {items.map((item, index) => {
            const content = (
              <>
                {item.icon && <span className="flex-shrink-0 text-slate-400">{item.icon}</span>}
                <span className="flex-1 truncate">{item.label}</span>
                {item.active && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />}
              </>
            );
            const classes = cn(
              'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
              item.tone === 'danger'
                ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700',
              item.disabled && 'pointer-events-none opacity-50',
              item.active && 'font-medium'
            );
            return (
              <div key={index} role="none">
                {item.separator && <div className="my-1 border-t border-slate-200 dark:border-slate-700" />}
                {item.href ? (
                  <Link href={item.href} role="menuitem" className={classes} onClick={() => setOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    className={classes}
                    onClick={() => {
                      setOpen(false);
                      item.onSelect?.();
                    }}
                  >
                    {content}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
