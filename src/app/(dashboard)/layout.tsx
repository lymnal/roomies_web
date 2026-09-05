// src/app/(dashboard)/layout.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { HouseholdProvider, useHousehold } from '@/context/HouseholdContext';
import Avatar from '@/components/ui/Avatar';
import { FullPageSpinner } from '@/components/ui/Spinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <HouseholdProvider>
      <DashboardShell>{children}</DashboardShell>
    </HouseholdProvider>
  );
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    money: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    tasks: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    members: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  };
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={paths[name]} />
    </svg>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, signOut } = useAuth();
  const { households, current, setCurrentId } = useHousehold();
  const router = useRouter();
  const pathname = usePathname();
  const [invitationCount, setInvitationCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, user, router, pathname]);

  // Pending invitations badge, kept fresh through realtime.
  useEffect(() => {
    const email = user?.email?.toLowerCase();
    if (!email) return;

    const load = async () => {
      const { count } = await supabaseClient
        .from('invitations')
        .select('id', { count: 'exact', head: true })
        .eq('email', email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());
      setInvitationCount(count ?? 0);
    };
    void load();

    const channel = supabaseClient
      .channel(`invitations:${email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations', filter: `email=eq.${email}` }, () => void load())
      .subscribe();

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [user?.email]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (isLoading || !user) {
    return <FullPageSpinner />;
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: 'home' },
    { name: 'Expenses', href: '/expenses', icon: 'money' },
    { name: 'Tasks', href: '/tasks', icon: 'tasks' },
    { name: 'Chat', href: '/chat', icon: 'chat' },
    ...(current ? [{ name: 'Members', href: `/households/${current.id}`, icon: 'members' }] : []),
  ];

  const displayName = (user.user_metadata?.name as string | undefined) || user.email || 'You';
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) || null;

  const navLinks = (compact: boolean) => (
    <>
      {navigation.map((item) => {
        const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`${
              active ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            } group flex items-center ${compact ? 'px-3 py-3 text-sm' : 'px-4 py-3 text-base'} font-medium rounded-md`}
          >
            <span className="mr-3 flex-shrink-0">
              <NavIcon name={item.icon} />
            </span>
            {item.name}
          </Link>
        );
      })}
      <Link
        href="/invitations"
        className={`${
          pathname === '/invitations' ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        } group flex items-center ${compact ? 'px-3 py-3 text-sm' : 'px-4 py-3 text-base'} font-medium rounded-md`}
      >
        <span className="mr-3 flex-shrink-0 relative">
          <NavIcon name="bell" />
          {invitationCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
              {invitationCount}
            </span>
          )}
        </span>
        Invitations
      </Link>
    </>
  );

  const householdSwitcher =
    households.length > 1 ? (
      <div className="px-4 mt-4">
        <label htmlFor="household-switcher" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Household
        </label>
        <select
          id="household-switcher"
          value={current?.id ?? ''}
          onChange={(e) => setCurrentId(e.target.value)}
          className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
        >
          {households.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>
    ) : current ? (
      <p className="px-4 mt-4 text-sm text-gray-500 dark:text-gray-400 truncate">{current.name}</p>
    ) : null;

  const userBlock = (
    <div className="flex items-center">
      <Avatar src={avatarUrl} name={displayName} size={40} />
      <div className="ml-3 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{displayName}</p>
        <div className="flex mt-1 space-x-2 text-xs">
          <Link href="/profile" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            Profile
          </Link>
          <Link href="/settings" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            Settings
          </Link>
          <button type="button" onClick={() => void signOut()} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 shadow-md p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-xl font-bold text-gray-900 dark:text-white">Roomies</span>
          <Link href="/profile" aria-label="Profile">
            <Avatar src={avatarUrl} name={displayName} size={32} />
          </Link>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative flex flex-col max-w-xs w-full bg-white dark:bg-gray-800 h-full">
            <div className="pt-5 pb-4">
              <div className="flex items-center justify-between px-4">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">Roomies</div>
                <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="text-gray-500 dark:text-gray-400" aria-label="Close menu">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {householdSwitcher}
              <nav className="mt-6 px-4 space-y-1">{navLinks(false)}</nav>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 mt-auto">{userBlock}</div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center justify-center flex-shrink-0 px-4">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">Roomies</span>
            </div>
            {householdSwitcher}
            <nav className="mt-6 flex-1 px-4 space-y-1">{navLinks(true)}</nav>
          </div>
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">{userBlock}</div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        <main className="flex-1 pt-20 pb-10 lg:pt-8 px-4 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
