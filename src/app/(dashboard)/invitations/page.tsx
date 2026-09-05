// src/app/(dashboard)/invitations/page.tsx
'use client';

import { usePageTitle } from '@/hooks/usePageTitle';
import UserInvitationsList from '@/components/invitations/UserInvitationsList';
import PageHeader from '@/components/ui/PageHeader';

export default function InvitationsPage() {
  usePageTitle('Invitations');
  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <PageHeader title="Invitations" description="Households that asked you to join." />
      <UserInvitationsList />
    </div>
  );
}
