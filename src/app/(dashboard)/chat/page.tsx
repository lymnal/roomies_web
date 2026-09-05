// src/app/(dashboard)/chat/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HiOutlineChatBubbleLeftRight } from 'react-icons/hi2';
import { useAuth } from '@/context/AuthContext';
import { useHousehold } from '@/context/HouseholdContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getHouseholdMessages, sendMessage, subscribeToMessages } from '@/lib/chat';
import { fetchMembers } from '@/lib/services/households';
import { cn, relativeDay } from '@/lib/utils';
import type { ChatMessage, Member } from '@/types';
import HouseholdRequired from '@/components/dashboard/HouseholdRequired';
import ChatInput from '@/components/chat/ChatInput';
import Alert from '@/components/ui/Alert';
import Avatar, { AvatarStack } from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { FullPageSpinner } from '@/components/ui/Spinner';

const RUN_GAP_MS = 5 * 60_000;

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(value: string): string {
  const date = new Date(value);
  const relative = relativeDay(date);
  if (relative === 'Today' || relative === 'Yesterday') return relative;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export default function ChatPage() {
  usePageTitle('Chat');
  const { current, loading } = useHousehold();
  const { user } = useAuth();

  if (loading || !user) return <FullPageSpinner />;
  if (!current) return <HouseholdRequired feature="chatting with your roommates" />;
  return <ChatRoom key={current.id} householdId={current.id} householdName={current.name} currentUserId={user.id} />;
}

interface DayGroup {
  key: string;
  label: string;
  messages: ChatMessage[];
}

function ChatRoom({ householdId, householdName, currentUserId }: { householdId: string; householdName: string; currentUserId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);

  const append = useCallback((message: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getHouseholdMessages(householdId)
      .then((list) => {
        if (!cancelled) setMessages(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load messages');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    fetchMembers(householdId)
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch(() => {
        // The member strip is decorative; the chat works without it.
      });

    const unsubscribe = subscribeToMessages(householdId, append);
    setConnected(true);
    return () => {
      cancelled = true;
      unsubscribe();
      setConnected(false);
    };
  }, [householdId, append]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current ? 'auto' : 'smooth' });
    if (messages.length > 0) firstScroll.current = false;
  }, [messages, loading]);

  const days = useMemo<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    for (const message of messages) {
      const key = new Date(message.createdAt).toDateString();
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.messages.push(message);
      else groups.push({ key, label: dayLabel(message.createdAt), messages: [message] });
    }
    return groups;
  }, [messages]);

  const handleSend = async (content: string) => {
    setSending(true);
    setError('');
    try {
      const message = await sendMessage(householdId, content);
      append(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card animate-fade-in lg:h-[calc(100vh-5rem)] dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-slate-800">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900 dark:text-white">{householdName}</h1>
          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-500' : 'bg-amber-400')} aria-hidden="true" />
            {connected ? 'Live' : 'Connecting…'}
            {members.length > 0 && ` · ${members.length} ${members.length === 1 ? 'member' : 'members'}`}
          </p>
        </div>
        {members.length > 0 && <AvatarStack people={members.map((m) => ({ name: m.name, avatar: m.avatar }))} size={28} max={5} />}
      </header>

      {error && (
        <div className="px-4 pt-3 sm:px-5">
          <Alert kind="error" onDismiss={() => setError('')}>
            {error}
          </Alert>
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {loading ? (
          <SkeletonList rows={4} />
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState icon={<HiOutlineChatBubbleLeftRight className="h-6 w-6" />} title="Say hi to your roommates" description="Messages are private to this household and arrive instantly." />
          </div>
        ) : (
          days.map((day) => (
            <div key={day.key}>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{day.label}</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>
              {day.messages.map((message, index) => {
                const mine = message.userId === currentUserId;
                const previous = day.messages[index - 1];
                const next = day.messages[index + 1];
                const startsRun = !previous || previous.userId !== message.userId || new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > RUN_GAP_MS;
                const endsRun = !next || next.userId !== message.userId || new Date(next.createdAt).getTime() - new Date(message.createdAt).getTime() > RUN_GAP_MS;
                const senderName = message.sender?.name ?? 'Unknown';
                return (
                  <div key={message.id} className={cn('flex gap-2', mine ? 'justify-end' : 'justify-start', startsRun ? 'mt-3' : 'mt-1')}>
                    {!mine && (startsRun ? <Avatar src={message.sender?.avatar} name={senderName} size={28} className="mt-5" /> : <div className="w-7 flex-shrink-0" />)}
                    <div className={cn('max-w-[80%] sm:max-w-[70%]', mine && 'text-right')}>
                      {startsRun && !mine && <p className="mb-1 ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">{senderName}</p>}
                      <div
                        className={cn(
                          'inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-left text-sm shadow-sm',
                          mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                        )}
                      >
                        {message.content}
                      </div>
                      {endsRun && <p className="mt-1 px-1 text-[11px] text-slate-400 dark:text-slate-500">{formatTime(message.createdAt)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-slate-200 p-3 sm:p-4 dark:border-slate-800">
        <ChatInput onSendMessage={(content) => void handleSend(content)} isLoading={sending} />
      </div>
    </div>
  );
}
