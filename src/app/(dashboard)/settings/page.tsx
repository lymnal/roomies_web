// src/app/(dashboard)/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import Card from '@/components/ui/Card';

const THEMES: { value: 'light' | 'dark' | 'system'; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
  { value: 'dark', label: 'Dark', icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' },
  { value: 'system', label: 'System', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes only knows the real theme after hydration.
  useEffect(() => setMounted(true), []);

  return (
    <div className="container mx-auto py-2">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>

      <div className="grid grid-cols-1 gap-6 max-w-2xl">
        <Card title="Appearance">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Choose how Roomies looks on this device.</p>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map((option) => {
              const active = mounted && theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={`flex flex-col items-center justify-center p-3 border rounded-md ${
                    active ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  aria-pressed={active}
                >
                  <svg className="h-6 w-6 text-gray-900 dark:text-white mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={option.icon} />
                  </svg>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{option.label}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="Account">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <li className="py-3 flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">Name, photo and password</span>
              <Link href="/profile" className="text-blue-600 dark:text-blue-400 hover:underline">
                Edit profile
              </Link>
            </li>
            <li className="py-3 flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">Households and invitations</span>
              <Link href="/invitations" className="text-blue-600 dark:text-blue-400 hover:underline">
                View invitations
              </Link>
            </li>
            <li className="py-3 flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">Delete your account</span>
              <Link href="/profile" className="text-red-600 dark:text-red-400 hover:underline">
                Danger zone
              </Link>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
