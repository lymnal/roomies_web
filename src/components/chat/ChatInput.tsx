// src/components/chat/ChatInput.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { HiOutlinePaperAirplane } from 'react-icons/hi2';
import Spinner from '@/components/ui/Spinner';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export default function ChatInput({ onSendMessage, isLoading = false, placeholder = 'Message your household…', disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  // Grow with the text up to a few lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [message]);

  const submit = () => {
    const trimmed = message.trim();
    if (!trimmed || isLoading || disabled) return;
    onSendMessage(trimmed);
    setMessage('');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-1.5 pl-3 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={1000}
        aria-label="Message"
        className="max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 dark:text-white dark:placeholder:text-slate-500"
      />
      <button
        type="submit"
        disabled={!message.trim() || isLoading || disabled}
        aria-label="Send message"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"
      >
        {isLoading ? <Spinner size="xs" className="text-white" /> : <HiOutlinePaperAirplane className="h-4 w-4" />}
      </button>
    </form>
  );
}
