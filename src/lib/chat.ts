// src/lib/chat.ts
// Household group chat on top of the `messages` table (RLS: members of the household only).
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabaseClient } from '@/lib/supabase';
import type { ChatMessage } from '@/types';

const MESSAGE_SELECT = 'id, household_id, user_id, content, edited, deleted, created_at, sender:profiles!messages_user_id_profiles_fkey(id, name, avatar_url)';
const PAGE_SIZE = 100;

interface MessageRow {
  id: string;
  household_id: string;
  user_id: string;
  content: string;
  edited: boolean | null;
  deleted: boolean | null;
  created_at: string;
  sender: { id: string; name: string | null; avatar_url: string | null } | { id: string; name: string | null; avatar_url: string | null }[] | null;
}

function toMessage(row: MessageRow): ChatMessage {
  const sender = Array.isArray(row.sender) ? row.sender[0] ?? null : row.sender;
  return {
    id: row.id,
    householdId: row.household_id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
    edited: Boolean(row.edited),
    sender: sender ? { id: sender.id, name: sender.name?.trim() || 'Unknown', avatar: sender.avatar_url } : null,
  };
}

export async function getHouseholdMessages(householdId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabaseClient
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('household_id', householdId)
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as MessageRow[]).map(toMessage).reverse();
}

export async function getMessage(messageId: string): Promise<ChatMessage | null> {
  const { data, error } = await supabaseClient.from('messages').select(MESSAGE_SELECT).eq('id', messageId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toMessage(data as unknown as MessageRow) : null;
}

export async function sendMessage(householdId: string, content: string): Promise<ChatMessage> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Message cannot be empty');
  if (trimmed.length > 1000) throw new Error('Messages are limited to 1000 characters');

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('You need to be signed in to send messages');

  const { data, error } = await supabaseClient
    .from('messages')
    .insert({ household_id: householdId, user_id: user.id, content: trimmed })
    .select(MESSAGE_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return toMessage(data as unknown as MessageRow);
}

/**
 * Subscribe to new messages in a household. The realtime payload has no joined profile, so the
 * full row is fetched on arrival. Returns an unsubscribe function.
 */
export function subscribeToMessages(householdId: string, onMessage: (message: ChatMessage) => void): () => void {
  const channel: RealtimeChannel = supabaseClient
    .channel(`messages:${householdId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `household_id=eq.${householdId}` },
      async (payload) => {
        const row = payload.new as Partial<MessageRow>;
        if (!row?.id) return;
        try {
          const full = await getMessage(row.id);
          if (full) {
            onMessage(full);
            return;
          }
        } catch {
          // fall through to the bare payload
        }
        onMessage(
          toMessage({
            id: row.id,
            household_id: row.household_id ?? householdId,
            user_id: row.user_id ?? '',
            content: row.content ?? '',
            edited: row.edited ?? false,
            deleted: row.deleted ?? false,
            created_at: row.created_at ?? new Date().toISOString(),
            sender: null,
          })
        );
      }
    )
    .subscribe();

  return () => {
    void supabaseClient.removeChannel(channel);
  };
}
