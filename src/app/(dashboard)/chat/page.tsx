// src/app/(dashboard)/chat/page.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useHousehold } from '@/context/HouseholdContext';
import { getHouseholdMessages, sendMessage, subscribeToMessages } from '@/lib/chat';
import type { ChatMessage } from '@/types';
import ChatInput from '@/components/chat/ChatInput';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import { FullPageSpinner } from '@/components/ui/Spinner';

function formatTimestamp(value: string): string {
  const now = new Date();
  const date = new Date(value);
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays < 7) {
    return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage() {
  const { current, loading } = useHousehold();
  const { user } = useAuth();

  if (loading || !user) return <FullPageSpinner />;
  if (!current) {
    return (
      <Alert kind="info">
        You are not in a household yet.{' '}
        <Link href="/dashboard" className="underline">
          Create or join one
        </Link>{' '}
        to start chatting.
      </Alert>
    );
  }
  return <ChatRoom key={current.id} householdId={current.id} householdName={current.name} currentUserId={user.id} />;
}

function ChatRoom({ householdId, householdName, currentUserId }: { householdId: string; householdName: string; currentUserId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

    const unsubscribe = subscribeToMessages(householdId, append);
    setConnected(true);
    return () => {
      cancelled = true;
      unsubscribe();
      setConnected(false);
    };
  }, [householdId, append]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-4rem)] bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-800 dark:text-white">{householdName}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Household chat · {connected ? 'live' : 'connecting…'}</p>
        </div>
      </div>

      {error && (
        <div className="px-4 pt-3">
          <Alert kind="error" onDismiss={() => setError('')}>
            {error}
          </Alert>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <FullPageSpinner />
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400">No messages yet. Say hi!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const mine = message.userId === currentUserId;
            const previous = messages[index - 1];
            const showSender = !previous || previous.userId !== message.userId || new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > 5 * 60_000;
            const senderName = message.sender?.name ?? 'Unknown';
            return (
              <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[80%] gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  {showSender && !mine ? <Avatar src={message.sender?.avatar} name={senderName} size={28} className="mt-5" /> : <div className="w-7 flex-shrink-0" />}
                  <div className={mine ? 'text-right' : ''}>
                    {showSender && <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{mine ? 'You' : senderName}</div>}
                    <div className={`inline-block rounded-lg px-4 py-2 break-words text-left ${mine ? 'bg-blue-500 text-white rounded-tr-none' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'}`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{formatTimestamp(message.createdAt)}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <ChatInput onSendMessage={(content) => void handleSend(content)} isLoading={sending} />
      </div>
    </div>
  );
}
