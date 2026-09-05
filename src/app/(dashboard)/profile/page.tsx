// src/app/(dashboard)/profile/page.tsx
'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { HiOutlineCamera, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { useAuth } from '@/context/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabaseClient } from '@/lib/supabase';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/Confirm';
import { FieldHint, FormField, Input } from '@/components/ui/Field';
import PageHeader from '@/components/ui/PageHeader';
import Skeleton from '@/components/ui/Skeleton';
import Spinner, { FullPageSpinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface Me {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  phone: string | null;
  createdAt: string;
  statistics: { expensesPaid: number; unsettledShares: number };
  households: { id: string; name: string; address: string | null; joinedAt: string; role: 'admin' | 'member' }[];
}

export default function ProfilePage() {
  usePageTitle('Your profile');
  const { user, isLoading, signOut } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<Me>('/api/users/me')
      .then((data) => {
        setMe(data);
        setName(data.name ?? '');
        setPhone(data.phone ?? '');
        setAvatar(data.avatar);
      })
      .catch((err) => setError(errorMessage(err, 'Failed to load your profile')));
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const updated = await apiFetch<{ name: string; phone: string | null }>('/api/users/me', { method: 'PATCH', json: { name: name.trim(), phone } });
      setMe((prev) => (prev ? { ...prev, name: updated.name, phone: updated.phone } : prev));
      toast.success('Profile updated');
    } catch (err) {
      setError(errorMessage(err, 'Failed to update profile'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2 MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabaseClient.storage.from('avatars').getPublicUrl(path);

      const { error: profileError } = await supabaseClient.from('profiles').update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (profileError) throw profileError;
      await supabaseClient.auth.updateUser({ data: { avatar_url: publicUrl } });
      setAvatar(publicUrl);
      toast.success('Photo updated');
    } catch (err) {
      setError(errorMessage(err, 'Failed to upload photo'));
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setChangingPassword(true);
    try {
      const { error: updateError } = await supabaseClient.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed');
    } catch (err) {
      setError(errorMessage(err, 'Failed to change password'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    const ok = await confirm({
      title: 'Delete your account?',
      description: 'Your profile and household memberships are removed and you are signed out. Expenses you paid stay in your households’ ledgers. This cannot be undone.',
      confirmLabel: 'Delete my account',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    setError('');
    try {
      await apiFetch('/api/users/me', { method: 'DELETE' });
      await signOut();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete account'));
      setDeleting(false);
    }
  };

  if (isLoading || !user) return <FullPageSpinner />;

  const displayName = me?.name || (user.user_metadata?.name as string | undefined) || user.email || 'You';
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Your profile" description="How your roommates see you." />

      {error && (
        <Alert kind="error" className="mb-6" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar src={avatar} name={displayName} size={112} />
                <label
                  className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-brand-600 text-white shadow-sm transition hover:bg-brand-700 dark:border-slate-900"
                  aria-label="Change photo"
                >
                  {uploading ? <Spinner size="xs" className="text-white" /> : <HiOutlineCamera className="h-4 w-4" />}
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => void handleAvatarChange(e)} disabled={uploading} />
                </label>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{displayName}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
              <p className="mt-1 text-xs text-slate-400">Member since {formatDate(me?.createdAt ?? user.created_at)}</p>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <dt className="text-xs text-slate-500 dark:text-slate-400">Expenses paid</dt>
                <dd className="mt-0.5 text-xl font-semibold text-slate-900 dark:text-white">{me ? me.statistics.expensesPaid : <Skeleton className="mx-auto h-6 w-8" />}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <dt className="text-xs text-slate-500 dark:text-slate-400">Unsettled shares</dt>
                <dd className="mt-0.5 text-xl font-semibold text-slate-900 dark:text-white">{me ? me.statistics.unsettledShares : <Skeleton className="mx-auto h-6 w-8" />}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Households" noPadding>
            {!me ? (
              <div className="p-5">
                <Skeleton className="h-10 w-full" />
              </div>
            ) : me.households.length === 0 ? (
              <p className="p-5 text-sm text-slate-500 dark:text-slate-400">You are not in a household yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {me.households.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{h.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Joined {formatDate(h.joinedAt)}</p>
                    </div>
                    <Badge tone={h.role === 'admin' ? 'purple' : 'neutral'}>{h.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Profile" description="Your name and phone are visible to your household.">
            <form onSubmit={handleProfileSave} className="space-y-4" noValidate>
              <FormField label="Full name" htmlFor="name">
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
              </FormField>
              <FormField label="Phone" htmlFor="phone" optional>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} autoComplete="tel" />
              </FormField>
              <div>
                <FormField label="Email" htmlFor="email">
                  <Input id="email" value={user.email ?? ''} readOnly disabled />
                </FormField>
                <FieldHint>Email changes go through your sign-in provider.</FieldHint>
              </div>
              <div className="flex justify-end">
                <Button type="submit" isLoading={isSaving} disabled={!name.trim()}>
                  Save changes
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Password">
            <form onSubmit={handlePasswordChange} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="New password" htmlFor="newPassword" hint="At least 8 characters">
                  <Input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
                </FormField>
                <FormField label="Confirm new password" htmlFor="confirmPassword" error={passwordMismatch ? 'Passwords do not match' : undefined}>
                  <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required invalid={passwordMismatch} />
                </FormField>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" isLoading={changingPassword} disabled={!newPassword || passwordMismatch}>
                  Change password
                </Button>
              </div>
            </form>
          </Card>

          <Card className="border-rose-200 dark:border-rose-900/60" title={<span className="flex items-center gap-2 text-rose-700 dark:text-rose-300"><HiOutlineExclamationTriangle className="h-5 w-5" /> Danger zone</span>}>
            <p className="text-sm text-slate-600 dark:text-slate-300">Deleting your account removes your profile and household memberships. Expenses you paid for stay in your households&apos; ledgers.</p>
            <Button variant="danger" className="mt-4" onClick={() => void handleDeleteAccount()} isLoading={deleting}>
              Delete account
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
