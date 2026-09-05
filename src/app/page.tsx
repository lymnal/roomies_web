// src/app/page.tsx
import Link from 'next/link';
import {
  HiOutlineArrowRight,
  HiOutlineBanknotes,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCheck,
  HiOutlineClipboardDocumentCheck,
  HiOutlineLink,
  HiOutlineScale,
  HiOutlineShieldCheck,
  HiOutlineUsers,
} from 'react-icons/hi2';
import Logo from '@/components/ui/Logo';

const FEATURES = [
  {
    icon: HiOutlineBanknotes,
    title: 'Split anything',
    text: 'Equal, percentage or custom splits. Every expense posts to a shared ledger, so balances always add up.',
  },
  {
    icon: HiOutlineScale,
    title: 'Settle up in one tap',
    text: 'Roomies computes the fewest payments that clear everyone, and records them the moment you tap Mark paid.',
  },
  {
    icon: HiOutlineClipboardDocumentCheck,
    title: 'Tasks that get done',
    text: 'Assign chores and to-dos with priorities, due dates and repeats. Overdue work is impossible to miss.',
  },
  {
    icon: HiOutlineChatBubbleLeftRight,
    title: 'One household chat',
    text: 'Real-time messaging next to the money and the chores, so the conversation and the decision live together.',
  },
];

const STEPS = [
  { icon: HiOutlineUsers, title: 'Create your household', text: 'Name your place. You become its admin.' },
  { icon: HiOutlineLink, title: 'Invite roommates', text: 'Share a join code or send an invitation link.' },
  { icon: HiOutlineCheck, title: 'Log the first expense', text: 'Balances, settle-up and tasks light up from there.' },
];

/** A product preview built from markup so it always matches the real UI. */
function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-400/30 via-teal-300/20 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-pop dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-1.5 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 text-xs text-slate-400">roomies · 42 Maple Street</span>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 p-4 text-white">
            <p className="text-xs uppercase tracking-wider text-white/80">You are owed</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">$86.50</p>
            <div className="mt-3 flex gap-2 text-xs">
              <span className="rounded-full bg-white/20 px-2 py-0.5">Sam owes $52.00</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5">Priya owes $34.50</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500">Open tasks</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">3</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500">This month</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">$1,240</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              ['Groceries', 'Alex paid · split 3 ways', '$96.30'],
              ['Internet', 'Priya paid · split 3 ways', '$60.00'],
              ['Cleaning supplies', 'You paid · split 3 ways', '$24.75'],
            ].map(([title, meta, amount]) => (
              <div key={title} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
                  <p className="text-xs text-slate-500">{meta}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{amount}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo size="md" />
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white sm:inline">
              Log in
            </Link>
            <Link href="/register" className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.14),transparent_60%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 py-20 lg:grid-cols-2 lg:py-28">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300">
                <HiOutlineShieldCheck className="h-4 w-4" /> Free for roommates
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                The calm way to <span className="bg-gradient-to-r from-brand-600 to-teal-500 bg-clip-text text-transparent">share a home</span>.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                Expenses, chores and chat in one place, with a ledger that keeps everyone honest. No spreadsheets, no awkward reminders.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 text-base font-medium text-white shadow-sm transition hover:bg-brand-700">
                  Create your household <HiOutlineArrowRight className="h-5 w-5" />
                </Link>
                <a href="#how-it-works" className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 px-6 text-base font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
                  See how it works
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-500">No credit card. Invite your roommates in under a minute.</p>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">Everything a shared home needs</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600 dark:text-slate-300">Built for households of two to six who want fairness without friction.</p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">Up and running in three steps</h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="relative rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
                  <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">Step {index + 1}</span>
                  <Icon className="h-7 w-7 text-brand-600 dark:text-brand-400" />
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-6 pb-20">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-slate-950 px-8 py-16 text-center text-white">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.35),transparent_60%)]" />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ready to simplify roommate living?</h2>
              <p className="mx-auto mt-4 max-w-xl text-slate-300">Set up your household now and invite everyone with a single link.</p>
              <Link href="/register" className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-base font-medium text-slate-900 shadow-sm transition hover:bg-slate-100">
                Get started free
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-10 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <Logo size="sm" />
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} Roomies</p>
        </div>
      </footer>
    </div>
  );
}
