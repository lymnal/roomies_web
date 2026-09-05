// src/app/(dashboard)/layout.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { IconType } from 'react-icons';
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineBanknotes,
  HiOutlineBell,
  HiOutlineChatBubbleLeftRight,
  HiOutlineChevronDown,
  HiOutlineClipboardDocumentCheck,
  HiOutlineCog6Tooth,
  HiOutlineHome,
  HiOutlinePlus,
  HiOutlineUser,
  HiOutlineUsers,
} from 'react-icons/hi2';
import { supabaseClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { HouseholdProvider, useHousehold } from '@/context/HouseholdContext';
import Avatar from '@/components/ui/Avatar';
import Logo from '@/components/ui/Logo';
import Menu from '@/components/ui/Menu';
import { FullPageSpinner } from '@/components/ui/Spinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <HouseholdProvider>
      <DashboardShell>{children}</DashboardShell>
    </HouseholdProvider>
  );
}

interface NavItem {
  name: string;
  href: string;
  icon: IconType;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, signOut } = useAuth();
  const { households, current, setCurrentId } = useHousehold();
  const router = useRouter();
  const pathname = usePathname();
  const [invitationCount, setInvitationCount] = useState(0);

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

  if (isLoading || !user) {
    return <FullPageSpinner />;
  }

  const navigation: NavItem[] = [
    { name: 'Home', href: '/dashboard', icon: HiOutlineHome },
    { name: 'Expenses', href: '/expenses', icon: HiOutlineBanknotes },
    { name: 'Tasks', href: '/tasks', icon: HiOutlineClipboardDocumentCheck },
    { name: 'Chat', href: '/chat', icon: HiOutlineChatBubbleLeftRight },
    { name: 'Members', href: current ? `/households/${current.id}` : '/dashboard', icon: HiOutlineUsers },
  ];

  const displayName = (user.user_metadata?.name as string | undefined) || user.email || 'You';
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) || null;

  const householdMenuItems = [
    ...households.map((h) => ({
      label: h.name,
      active: h.id === current?.id,
      onSelect: () => setCurrentId(h.id),
    })),
    {
      label: 'Create or join a household',
      href: '/households/new',
      icon: <HiOutlinePlus className="h-4 w-4" />,
      separator: households.length > 0,
    },
  ];

  const userMenuItems = [
    { label: 'Your profile', href: '/profile', icon: <HiOutlineUser className="h-4 w-4" /> },
    { label: 'Settings', href: '/settings', icon: <HiOutlineCog6Tooth className="h-4 w-4" /> },
    {
      label: invitationCount > 0 ? `Invitations (${invitationCount})` : 'Invitations',
      href: '/invitations',
      icon: <HiOutlineBell className="h-4 w-4" />,
    },
    { label: 'Sign out', onSelect: () => void signOut(), icon: <HiOutlineArrowRightOnRectangle className="h-4 w-4" />, tone: 'danger' as const, separator: true },
  ];

  const householdSwitcher = (
    <Menu
      align="left"
      ariaLabel="Switch household"
      className="w-full"
      trigger={({ open }) => (
        <span
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800',
            open && 'ring-2 ring-brand-500/30'
          )}
        >
          <span className="min-w-0">
            <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Household</span>
            <span className="block truncate font-medium text-slate-900 dark:text-white">{current?.name ?? 'No household yet'}</span>
          </span>
          <HiOutlineChevronDown className={cn('h-4 w-4 flex-shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
        </span>
      )}
      items={householdMenuItems}
    />
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="px-5 pb-2 pt-6">
          <Logo href="/dashboard" size="md" className="text-slate-900 dark:text-white" />
        </div>
        <div className="px-4 pt-4">{householdSwitcher}</div>
        <nav className="mt-4 flex-1 space-y-1 px-3" aria-label="Main">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <item.icon className={cn('h-5 w-5 flex-shrink-0', active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200')} />
                {item.name}
              </Link>
            );
          })}
          <Link
            href="/invitations"
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              pathname === '/invitations'
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            )}
          >
            <HiOutlineBell className={cn('h-5 w-5 flex-shrink-0', pathname === '/invitations' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 group-hover:text-slate-600')} />
            <span className="flex-1">Invitations</span>
            {invitationCount > 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">{invitationCount}</span>}
          </Link>
        </nav>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <Menu
            align="left"
            placement="top"
            ariaLabel="Account menu"
            className="w-full"
            trigger={() => (
              <span className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <Avatar src={avatarUrl} name={displayName} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{displayName}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</span>
                </span>
                <HiOutlineChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
              </span>
            )}
            items={userMenuItems}
          />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 lg:hidden">
        <Logo href="/dashboard" size="sm" className="text-slate-900 dark:text-white" />
        {households.length > 0 && (
          <Menu
            align="right"
            ariaLabel="Switch household"
            trigger={({ open }) => (
              <span className="flex max-w-[45vw] items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span className="truncate">{current?.name ?? 'Household'}</span>
                <HiOutlineChevronDown className={cn('h-4 w-4 flex-shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
              </span>
            )}
            items={householdMenuItems}
          />
        )}
        <Menu
          align="right"
          ariaLabel="Account menu"
          trigger={() => (
            <span className="relative inline-flex">
              <Avatar src={avatarUrl} name={displayName} size={32} />
              {invitationCount > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white dark:ring-slate-900" />}
            </span>
          )}
          items={userMenuItems}
        />
      </header>

      {/* Mobile bottom tabs */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden" aria-label="Main">
        <ul className="grid grid-cols-5">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn('flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors', active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400')}
                  aria-current={active ? 'page' : undefined}
                >
                  <item.icon className="h-6 w-6" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-20 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>
      </div>
    </div>
  );
}
