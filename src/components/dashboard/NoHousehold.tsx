// src/components/dashboard/NoHousehold.tsx
// First-run experience: create a household or join one with a code.
'use client';

import { useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { createHousehold, joinHousehold } from '@/lib/services/households';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import UserInvitationsList from '@/components/invitations/UserInvitationsList';

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white';

export default function NoHousehold({ onJoined }: { onJoined: (householdId: string) => void }) {
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
      onJoined(household.id);
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
      onJoined(result.householdId);
    } catch (err) {
      setJoinError(errorMessage(err, 'Failed to join household'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to Roomies</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Start a household for your place, or join the one your roommate already set up.</p>
      </div>

      <UserInvitationsList compact />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Create a household">
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && <Alert kind="error">{createError}</Alert>}
            <div>
              <label htmlFor="household-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Household name
              </label>
              <input id="household-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="e.g. 42 Maple Street" className={inputClass} />
            </div>
            <div>
              <label htmlFor="household-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Address <span className="text-gray-400">(optional)</span>
              </label>
              <input id="household-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} className={inputClass} />
            </div>
            <Button type="submit" variant="primary" fullWidth isLoading={creating} disabled={creating || !name.trim()}>
              Create household
            </Button>
          </form>
        </Card>

        <Card title="Join with a code">
          <form onSubmit={handleJoin} className="space-y-4">
            {joinError && <Alert kind="error">{joinError}</Alert>}
            <p className="text-sm text-gray-600 dark:text-gray-400">Ask a household admin for the join code shown on their dashboard.</p>
            <div>
              <label htmlFor="join-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Join code
              </label>
              <input
                id="join-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={12}
                placeholder="ABC123"
                className={`${inputClass} font-mono tracking-widest uppercase`}
                autoCapitalize="characters"
              />
            </div>
            <Button type="submit" variant="secondary" fullWidth isLoading={joining} disabled={joining || code.trim().length < 4}>
              Join household
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
