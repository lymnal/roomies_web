// src/components/dashboard/NoHousehold.tsx
// First-run experience: create a household or join one with a code.
'use client';

import { useState } from 'react';
import { HiOutlineHomeModern, HiOutlineKey, HiOutlinePlus } from 'react-icons/hi2';
import { errorMessage } from '@/lib/api-client';
import { createHousehold, joinHousehold } from '@/lib/services/households';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Field';
import UserInvitationsList from '@/components/invitations/UserInvitationsList';

interface NoHouseholdProps {
  onJoined: (householdId: string) => void | Promise<void>;
  title?: string;
}

export default function NoHousehold({ onJoined, title = 'Welcome to Roomies' }: NoHouseholdProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const household = await createHousehold({ name: name.trim(), address: address.trim() || undefined });
      await onJoined(household.id);
    } catch (err) {
      setCreateError(errorMessage(err, 'Failed to create household'));
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoining(true);
    try {
      const result = await joinHousehold(code.trim());
      await onJoined(result.householdId);
    } catch (err) {
      setJoinError(errorMessage(err, 'Failed to join household'));
    } finally {
      setJoining(false);
    }
  };

  const panel = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900';

  return (
    <div className="mx-auto max-w-4xl animate-slide-up space-y-8">
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-teal-600 text-white shadow-pop">
          <HiOutlineHomeModern className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-slate-500 dark:text-slate-400">Start a household for your place, or join the one a roommate already set up.</p>
      </div>

      <UserInvitationsList compact />

      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={handleCreate} className={panel} noValidate>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
              <HiOutlinePlus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Create a household</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">You become its admin.</p>
            </div>
          </div>
          {createError && (
            <Alert kind="error" className="mt-4">
              {createError}
            </Alert>
          )}
          <div className="mt-5 space-y-4">
            <FormField label="Household name" htmlFor="household-name">
              <Input id="household-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="e.g. 42 Maple Street" autoComplete="off" />
            </FormField>
            <FormField label="Address" htmlFor="household-address" optional>
              <Input id="household-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} autoComplete="street-address" />
            </FormField>
          </div>
          <Button type="submit" size="lg" fullWidth className="mt-6" isLoading={creating} disabled={!name.trim()}>
            Create household
          </Button>
        </form>

        <form onSubmit={handleJoin} className={panel} noValidate>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
              <HiOutlineKey className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Join with a code</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Ask an admin for the household join code.</p>
            </div>
          </div>
          {joinError && (
            <Alert kind="error" className="mt-4">
              {joinError}
            </Alert>
          )}
          <div className="mt-5">
            <FormField label="Join code" htmlFor="join-code">
              <Input
                id="join-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={12}
                placeholder="ABC123"
                autoCapitalize="characters"
                autoComplete="off"
                className="h-14 text-center font-mono text-2xl uppercase tracking-[0.3em]"
              />
            </FormField>
          </div>
          <Button type="submit" size="lg" variant="secondary" fullWidth className="mt-6" isLoading={joining} disabled={code.trim().length < 4}>
            Join household
          </Button>
        </form>
      </div>
    </div>
  );
}
