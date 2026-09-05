// src/components/ui/Field.tsx
// Form primitives that share one look: Label, Input, Select, Textarea, FormField.
'use client';

import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const inputClassName =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-brand-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400';

const invalidClassName = 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/30 dark:border-rose-500';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, invalid, ...props }, ref) => (
  <input ref={ref} className={cn(inputClassName, invalid && invalidClassName, className)} {...props} />
));
Input.displayName = 'Input';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, invalid, children, ...props }, ref) => (
  <select ref={ref} className={cn(inputClassName, 'pr-9', invalid && invalidClassName, className)} {...props}>
    {children}
  </select>
));
Select.displayName = 'Select';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, invalid, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputClassName, 'min-h-[5rem] resize-y', invalid && invalidClassName, className)} {...props} />
));
Textarea.displayName = 'Textarea';

export function Label({ htmlFor, children, optional, className }: { htmlFor?: string; children: ReactNode; optional?: boolean; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200', className)}>
      {children}
      {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
    </label>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{children}</p>;
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
      {children}
    </p>
  );
}

interface FormFieldProps {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, hint, error, optional, className, children }: FormFieldProps) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} optional={optional}>
        {label}
      </Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}

/** A checkbox with its label on one line. */
export function Checkbox({ id, label, className, ...props }: InputProps & { label: ReactNode }) {
  return (
    <label htmlFor={id} className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200', className)}>
      <input
        id={id}
        type="checkbox"
        className="form-checkbox h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800"
        {...props}
      />
      {label}
    </label>
  );
}
