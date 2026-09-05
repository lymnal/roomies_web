// src/components/auth/AuthLayout.tsx
// Split-screen frame for sign-in / sign-up / password pages.
import { ReactNode } from 'react';
import { HiOutlineCheckCircle } from 'react-icons/hi2';
import Logo from '@/components/ui/Logo';

interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

const PROMISES = ['Split bills with a ledger that always adds up', 'Tasks and chores everyone can see', 'One chat for the whole house'];

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(20,184,166,0.28),transparent_50%)]"
        />
        <div className="relative">
          <Logo size="md" className="text-white" />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">Shared living, without the awkward money talk.</h2>
          <ul className="mt-8 space-y-3 text-slate-300">
            {PROMISES.map((line) => (
              <li key={line} className="flex items-start gap-3">
                <HiOutlineCheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-400" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-slate-400">Free for households of any size.</p>
      </aside>

      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 lg:hidden">
            <Logo size="md" className="text-slate-900 dark:text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
