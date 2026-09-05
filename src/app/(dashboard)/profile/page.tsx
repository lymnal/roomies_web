// src/app/(dashboard)/profile/page.tsx
'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabase';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import Alert from '@/components/ui/Alert';
import Card from '@/components/ui/Card';
import { FullPageSpinner } from '@/components/ui/Spinner';

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

const inputClass =
  'w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white border-gray-300';

export default function ProfilePage() {
  const { user, isLoading, signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const flash = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const updated = await apiFetch<{ name: string; phone: string | null }>('/api/users/me', { method: 'PATCH', json: { name: name.trim(), phone } });
      setMe((prev) => (prev ? { ...prev, name: updated.name, phone: updated.phone } : prev));
      flash('Profile updated');
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
      setError('Image must be smaller than 2 MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
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
      flash('Photo updated');
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
      flash('Password changed');
    } catch (err) {
      setError(errorMessage(err, 'Failed to change password'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete your account? This removes your profile and memberships and cannot be undone.')) return;
    setError('');
    try {
      await apiFetch('/api/users/me', { method: 'DELETE' });
      await signOut();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete account'));
    }
  };

  if (isLoading || !user) return <FullPageSpinner />;

  const displayName = me?.name || (user.user_metadata?.name as string | undefined) || user.email || 'You';

  return (
    <div className="container mx-auto py-2">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Your profile</h1>

      {success && (
        <Alert kind="success" className="mb-4" onDismiss={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert kind="error" className="mb-4" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center">
              <Avatar src={avatar} name={displayName} size={120} />
              <label className="mt-3 text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                {uploading ? 'Uploading…' : 'Change photo'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleAvatarChange(e)} disabled={uploading} />
              </label>
              <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">{displayName}</h2>
              <p className="text-gray-500 dark:text-gray-400">{user.email}</p>
              <dl className="mt-6 w-full space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600 dark:text-gray-300">Member since</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{formatDate(me?.createdAt ?? user.created_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600 dark:text-gray-300">Expenses paid</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{me?.statistics.expensesPaid ?? '…'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600 dark:text-gray-300">Unsettled shares</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{me?.statistics.unsettledShares ?? '…'}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card title="Households">
            {!me ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : me.households.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">You are not in a household yet.</p>
            ) : (
              <ul className="space-y-3">
                {me.households.map((h) => (
                  <li key={h.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{h.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Joined {formatDate(h.joinedAt)}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">{h.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card title="Profile information">
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full name
                </label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} className={inputClass} />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Phone <span className="text-gray-400">(optional, visible to your household)</span>
                </label>
                <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} className={inputClass} />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email address
                </label>
                <input id="email" value={user.email ?? ''} readOnly className={`${inputClass} bg-gray-50 dark:bg-gray-800 text-gray-500`} />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Email changes go through your sign-in provider.</p>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={isSaving || !name.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {isSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </Card>

          <Card title="Change password">
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New password
                </label>
                <input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className={inputClass} />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm new password
                </label>
                <input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className={inputClass} />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={changingPassword} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {changingPassword ? 'Changing…' : 'Change password'}
                </button>
              </div>
            </form>
          </Card>

          <Card title="Danger zone">
            <p className="text-sm text-gray-600 dark:text-gray-300">Deleting your account removes your profile and household memberships. Expenses you paid for stay in your households&apos; ledgers.</p>
            <button type="button" onClick={() => void handleDeleteAccount()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
              Delete account
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
