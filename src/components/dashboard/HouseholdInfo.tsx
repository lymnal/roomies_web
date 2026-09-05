// src/components/dashboard/HouseholdInfo.tsx
'use client';

import { useEffect, useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { regenerateJoinCode, updateHousehold } from '@/lib/services/households';
import { formatDate } from '@/lib/utils';
import type { Household, HouseholdRole } from '@/types';
import Alert from '@/components/ui/Alert';

interface HouseholdInfoProps {
  household: Household;
  role: HouseholdRole;
  memberCount: number;
  onUpdated?: (household: Household) => void;
}

const inputClass =
  'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 w-full text-gray-900 dark:text-white';

export default function HouseholdInfo({ household, role, memberCount, onUpdated }: HouseholdInfoProps) {
  const isAdmin = role === 'admin';
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(household.name);
  const [address, setAddress] = useState(household.address ?? '');
  const [joinCode, setJoinCode] = useState(household.joinCode ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(household.name);
    setAddress(household.address ?? '');
    setJoinCode(household.joinCode ?? null);
  }, [household.name, household.address, household.joinCode]);

  const handleSave = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const updated = await updateHousehold(household.id, { name: name.trim(), address: address.trim() || null });
      setIsEditing(false);
      onUpdated?.(updated);
    } catch (err) {
      setError(errorMessage(err, 'Failed to update household'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRotate = async () => {
    setRotating(true);
    setError('');
    try {
      const { joinCode: next } = await regenerateJoinCode(household.id);
      setJoinCode(next);
    } catch (err) {
      setError(errorMessage(err, 'Failed to regenerate join code'));
    } finally {
      setRotating(false);
    }
  };

  const copyCode = async () => {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context); the code is still visible to copy by hand.
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      {error && (
        <Alert kind="error" className="mb-4" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="household-name" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Name
                </label>
                <input id="household-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={`${inputClass} text-xl font-bold`} />
              </div>
              <div>
                <label htmlFor="household-address" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Address
                </label>
                <input id="household-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} className={inputClass} placeholder="Optional" />
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{household.name}</h2>
              <p className="text-gray-600 dark:text-gray-300">{household.address || <span className="text-gray-400">No address yet</span>}</p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {memberCount} {memberCount === 1 ? 'member' : 'members'} · created {formatDate(household.createdAt)}
              </p>
            </>
          )}
        </div>

        {isAdmin && (
          <div className="flex gap-2 flex-shrink-0">
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setName(household.name);
                  setAddress(household.address ?? '');
                }}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={() => (isEditing ? void handleSave() : setIsEditing(true))}
              disabled={isSubmitting || (isEditing && !name.trim())}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving…' : isEditing ? 'Save' : 'Edit'}
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Join code</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Roommates can enter this code on their dashboard to join instantly.</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-700 text-lg font-mono tracking-widest text-gray-900 dark:text-white">{joinCode ?? '——'}</code>
            <button type="button" onClick={() => void copyCode()} disabled={!joinCode} className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" onClick={() => void handleRotate()} disabled={rotating} className="text-sm text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-50">
              {rotating ? 'Rotating…' : joinCode ? 'New code' : 'Generate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
