// src/components/invitations/InvitationForm.tsx
'use client';

import { useState } from 'react';
import { HiOutlineClipboardDocument, HiOutlineLink } from 'react-icons/hi2';
import { errorMessage } from '@/lib/api-client';
import { createInvitation } from '@/lib/services/invitations';
import { relativeDay } from '@/lib/utils';
import type { HouseholdRole } from '@/types';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { FormField, Input, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

interface InvitationFormProps {
  householdId: string;
  onInviteSent?: () => void;
  onCancel?: () => void;
}

export default function InvitationForm({ householdId, onInviteSent, onCancel }: InvitationFormProps) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<HouseholdRole>('member');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ email: string; link: string; expiresAt: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await createInvitation({ householdId, email: email.trim(), role, message: message.trim() || undefined });
      setCreated({ email: email.trim(), link: result.invitationLink, expiresAt: result.invitation.expiresAt });
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
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.link);
      toast.success('Invitation link copied', `Send it to ${created.email}.`);
    } catch {
      toast.error('Could not copy the link', 'Select it and copy by hand.');
    }
  };

  if (created) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Alert kind="success" title={`Invitation ready for ${created.email}`}>
          Email delivery isn&apos;t set up yet, so send them this link yourself. It expires {relativeDay(created.expiresAt)}.
        </Alert>
        <div className="flex items-stretch gap-2">
          <Input readOnly value={created.link} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" aria-label="Invitation link" />
          <Button variant="outline" leftIcon={<HiOutlineClipboardDocument className="h-4 w-4" />} onClick={() => void copyLink()}>
            Copy
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCreated(null)}>
            Invite someone else
          </Button>
          {onCancel && <Button onClick={onCancel}>Done</Button>}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <Alert kind="error">{error}</Alert>}

      <FormField label="Email address" htmlFor="invite-email">
        <Input id="invite-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="roommate@example.com" required />
      </FormField>

      <FormField
        label="Role"
        htmlFor="invite-role"
        hint={role === 'admin' ? 'Admins also manage members, the join code and household details.' : 'Members add expenses, tasks and messages.'}
      >
        <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as HouseholdRole)}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </Select>
      </FormField>

      <FormField label="Personal message" htmlFor="invite-message" optional>
        <Textarea
          id="invite-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Hey! Join our place on Roomies so we can split the bills."
        />
      </FormField>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" isLoading={isSubmitting} disabled={!email.trim()} leftIcon={<HiOutlineLink className="h-4 w-4" />}>
          Create invitation link
        </Button>
      </div>
    </form>
  );
}
