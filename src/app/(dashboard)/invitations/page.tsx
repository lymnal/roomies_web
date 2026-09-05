'use client';

import UserInvitationsList from '@/components/invitations/UserInvitationsList';

export default function InvitationsPage() {
  return (
    <div className="container mx-auto py-2">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Your invitations</h1>
      <UserInvitationsList />
    </div>
  );
}
