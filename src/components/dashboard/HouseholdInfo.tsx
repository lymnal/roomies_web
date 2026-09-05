// src/components/dashboard/HouseholdInfo.tsx
'use client';

import { useEffect, useState } from 'react';
import { HiOutlineArrowPath, HiOutlineClipboardDocument, HiOutlineMapPin, HiOutlinePencilSquare } from 'react-icons/hi2';
import { errorMessage } from '@/lib/api-client';
import { regenerateJoinCode, updateHousehold } from '@/lib/services/households';
import { formatDate } from '@/lib/utils';
import type { Household, HouseholdRole } from '@/types';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/Confirm';
import { FormField, Input } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

interface HouseholdInfoProps {
  household: Household;
  role: HouseholdRole;
  memberCount: number;
  onUpdated?: (household: Household) => void;
}

export default function HouseholdInfo({ household, role, memberCount, onUpdated }: HouseholdInfoProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = role === 'admin';
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(household.name);
  const [address, setAddress] = useState(household.address ?? '');
  const [joinCode, setJoinCode] = useState(household.joinCode ?? null);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(household.name);
    setAddress(household.address ?? '');
    setJoinCode(household.joinCode ?? null);
  }, [household.name, household.address, household.joinCode]);

  const closeEditor = () => {
    setEditing(false);
    setName(household.name);
    setAddress(household.address ?? '');
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await updateHousehold(household.id, { name: name.trim(), address: address.trim() || null });
      setEditing(false);
      onUpdated?.(updated);
      toast.success('Household updated');
    } catch (err) {
      setError(errorMessage(err, 'Failed to update household'));
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async () => {
    if (joinCode) {
      const ok = await confirm({
        title: 'Generate a new join code?',
        description: 'The current code stops working immediately. Anyone you already gave it to will need the new one.',
        confirmLabel: 'New code',
      });
      if (!ok) return;
    }
    setRotating(true);
    try {
      const { joinCode: next } = await regenerateJoinCode(household.id);
      setJoinCode(next);
      toast.success('New join code ready');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to generate a join code'));
    } finally {
      setRotating(false);
    }
  };

  const copyCode = async () => {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(joinCode);
      toast.success('Join code copied');
    } catch {
      toast.error('Could not copy', 'Select the code and copy it by hand.');
    }
  };

  return (
    <>
      <Card
        title={
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">Household</p>
            <h3 className="truncate text-lg font-semibold text-slate-900 dark:text-white">{household.name}</h3>
          </div>
        }
        actions={
          isAdmin && (
            <Button variant="ghost" size="sm" leftIcon={<HiOutlinePencilSquare className="h-4 w-4" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )
        }
      >
        <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
          <HiOutlineMapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
          <span>{household.address || <span className="text-slate-400">No address yet</span>}</span>
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <dt className="text-xs text-slate-500 dark:text-slate-400">Members</dt>
            <dd className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">{memberCount}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <dt className="text-xs text-slate-500 dark:text-slate-400">Created</dt>
            <dd className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">{formatDate(household.createdAt)}</dd>
          </div>
        </dl>

        {isAdmin && (
          <div className="mt-4 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-4 dark:border-brand-800 dark:bg-brand-900/20">
            <p className="text-sm font-medium text-slate-900 dark:text-white">Join code</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Roommates enter this on their dashboard to join instantly.</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 text-center font-mono text-lg font-semibold tracking-[0.25em] text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white">
                {joinCode ?? '——'}
              </code>
              <Button variant="outline" size="icon" aria-label="Copy join code" onClick={() => void copyCode()} disabled={!joinCode}>
                <HiOutlineClipboardDocument className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label={joinCode ? 'Generate a new join code' : 'Generate a join code'} onClick={() => void handleRotate()} isLoading={rotating}>
                <HiOutlineArrowPath className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={editing}
        onClose={closeEditor}
        title="Edit household"
        dismissible={!saving}
        footer={
          <>
            <Button variant="outline" onClick={closeEditor} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="household-edit-form" isLoading={saving} disabled={!name.trim()}>
              Save changes
            </Button>
          </>
        }
      >
        <form id="household-edit-form" onSubmit={handleSave} className="space-y-4" noValidate>
          {error && <Alert kind="error">{error}</Alert>}
          <FormField label="Name" htmlFor="edit-household-name">
            <Input id="edit-household-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus />
          </FormField>
          <FormField label="Address" htmlFor="edit-household-address" optional>
            <Input id="edit-household-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} autoComplete="street-address" />
          </FormField>
        </form>
      </Modal>
    </>
  );
}
