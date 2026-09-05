// src/components/invitations/InvitationForm.tsx
'use client';

import { useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { createInvitation } from '@/lib/services/invitations';
import type { HouseholdRole } from '@/types';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';

interface InvitationFormProps {
  householdId: string;
  onInviteSent?: () => void;
  onCancel?: () => void;
}

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white';

export default function InvitationForm({ householdId, onInviteSent, onCancel }: InvitationFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<HouseholdRole>('member');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [invitationLink, setInvitationLink] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInvitationLink('');
    setIsSubmitting(true);
    try {
      const result = await createInvitation({ householdId, email: email.trim(), role, message: message.trim() || undefined });
      setSentTo(email.trim());
      setInvitationLink(result.invitationLink);
      setEmail('');
      setRole('member');
      setMessage('');
      onInviteSent?.();
    } catch (err) {
      setError(errorMessage(err, 'Failed to create invitation'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable; the link is visible in the input.
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert kind="error">{error}</Alert>}

      {invitationLink && (
        <Alert kind="success">
          <p>Invitation created for {sentTo}.</p>
          <p className="mt-1 text-xs">Email delivery isn&apos;t set up yet, so share this link with them directly:</p>
          <div className="mt-2 flex">
            <input type="text" readOnly value={invitationLink} className="flex-1 p-2 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-l-md" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={() => void copyLink()} className="px-3 py-2 text-xs bg-blue-600 text-white rounded-r-md hover:bg-blue-700">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </Alert>
      )}

      <div>
        <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Email address
        </label>
        <input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="roommate@example.com" required className={inputClass} />
      </div>

      <div>
        <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Role
        </label>
        <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as HouseholdRole)} className={inputClass}>
          <option value="member">Member — adds expenses, tasks and messages</option>
          <option value="admin">Admin — also manages members and settings</option>
        </select>
      </div>

      <div>
        <label htmlFor="invite-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Personal message <span className="text-gray-400">(optional)</span>
        </label>
        <textarea id="invite-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={500} className={inputClass} />
      </div>

      <div className="flex justify-end space-x-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
          Create invitation
        </Button>
      </div>
    </form>
  );
}
