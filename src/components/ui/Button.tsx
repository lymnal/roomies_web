// src/components/ui/Button.tsx
'use client';

import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import Spinner from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

const BASE =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-slate-900';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:ring-brand-500',
  secondary:
    'bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  outline:
    'border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400 dark:text-slate-200 dark:hover:bg-slate-800',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-500',
  link: 'h-auto px-0 text-brand-600 hover:underline focus-visible:ring-brand-500 dark:text-brand-400',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 gap-1 px-2.5 text-xs',
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-base',
  icon: 'h-9 w-9 p-0',
};

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/** The button look as a class string, for links that should read as buttons. */
export function buttonClasses({ variant = 'primary', size = 'md', fullWidth = false, className = '' }: ButtonStyleOptions): string {
  return cn(BASE, VARIANTS[variant], variant === 'link' ? 'text-sm' : SIZES[size], fullWidth && 'w-full', className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { children, variant = 'primary', size = 'md', fullWidth = false, isLoading = false, disabled, leftIcon, rightIcon, className = '', type = 'button', ...props },
    ref
  ) => (
    <button ref={ref} type={type} disabled={disabled || isLoading} className={buttonClasses({ variant, size, fullWidth, className })} {...props}>
      {isLoading ? <Spinner size="xs" className="text-current" /> : leftIcon ? <span className="-ml-0.5 flex-shrink-0">{leftIcon}</span> : null}
      {children}
      {!isLoading && rightIcon && <span className="-mr-0.5 flex-shrink-0">{rightIcon}</span>}
    </button>
  )
);

Button.displayName = 'Button';

export default Button;
