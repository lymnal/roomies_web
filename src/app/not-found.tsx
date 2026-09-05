import Link from 'next/link';
import { HiOutlineHomeModern } from 'react-icons/hi2';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-950">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
        <HiOutlineHomeModern className="h-7 w-7" />
      </div>
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">That page moved out</h1>
      <p className="mt-2 max-w-sm text-slate-500 dark:text-slate-400">The link may be old, or the page never existed.</p>
      <Link href="/dashboard" className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
        Go to your dashboard
      </Link>
    </div>
  );
}
