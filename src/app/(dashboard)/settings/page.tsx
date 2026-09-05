// src/app/(dashboard)/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import type { IconType } from 'react-icons';
import { HiOutlineBell, HiOutlineChevronRight, HiOutlineComputerDesktop, HiOutlineMoon, HiOutlinePlus, HiOutlineSun, HiOutlineUserCircle } from 'react-icons/hi2';
import { useHousehold } from '@/context/HouseholdContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';

const THEMES: { value: 'light' | 'dark' | 'system'; label: string; hint: string; icon: IconType }[] = [
  { value: 'light', label: 'Light', hint: 'Bright and clean', icon: HiOutlineSun },
  { value: 'dark', label: 'Dark', hint: 'Easy on the eyes', icon: HiOutlineMoon },
  { value: 'system', label: 'System', hint: 'Follows your device', icon: HiOutlineComputerDesktop },
];

export default function SettingsPage() {
  usePageTitle('Settings');
  const { theme, setTheme } = useTheme();
  const { households, current, setCurrentId } = useHousehold();
  const [mounted, setMounted] = useState(false);

  // next-themes only knows the real theme after hydration.
  useEffect(() => setMounted(true), []);

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <PageHeader title="Settings" description="Appearance, households and your account." />

      <div className="space-y-6">
        <Card title="Appearance" description="Choose how Roomies looks on this device.">
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map((option) => {
              const active = mounted && theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-xl border p-4 text-center transition',
                    active
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30 dark:bg-brand-900/30'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
                  )}
                >
                  <option.icon className={cn('mb-2 h-6 w-6', active ? 'text-brand-600 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400')} />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{option.label}</span>
                  <span className="mt-0.5 hidden text-xs text-slate-500 sm:block dark:text-slate-400">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="Households" description="Switch which household the app shows." noPadding>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {households.map((household) => {
              const active = household.id === current?.id;
              return (
                <li key={household.id}>
                  <button
                    type="button"
                    onClick={() => setCurrentId(household.id)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    aria-pressed={active}
                  >
                    <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', active ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600')} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{household.name}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {household.memberCount} {household.memberCount === 1 ? 'member' : 'members'}
                        {household.address ? ` · ${household.address}` : ''}
                      </span>
                    </span>
                    <Badge tone={household.role === 'admin' ? 'purple' : 'neutral'}>{household.role}</Badge>
                    {active && <Badge tone="brand">Current</Badge>}
                  </button>
                </li>
              );
            })}
            <li>
              <Link href="/households/new" className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-brand-600 transition-colors hover:bg-slate-50 dark:text-brand-400 dark:hover:bg-slate-800/60">
                <HiOutlinePlus className="h-4 w-4" /> Create or join another household
              </Link>
            </li>
          </ul>
        </Card>

        <Card title="Account" noPadding>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            <li>
              <Link href="/profile" className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <HiOutlineUserCircle className="h-5 w-5 text-slate-400" />
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">Name, photo and password</span>
                <HiOutlineChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            </li>
            <li>
              <Link href="/invitations" className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <HiOutlineBell className="h-5 w-5 text-slate-400" />
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">Invitations</span>
                <HiOutlineChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            </li>
            <li>
              <Link href="/profile" className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className="h-5 w-5" aria-hidden="true" />
                <span className="flex-1 text-sm text-rose-600 dark:text-rose-400">Delete your account</span>
                <HiOutlineChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
