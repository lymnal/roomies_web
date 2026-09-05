// src/components/invitations/InviteModal.tsx
'use client';

import { useState } from 'react';
import InvitationForm from './InvitationForm';
import PendingInvitations from './PendingInvitations';

interface InviteModalProps {
  householdId: string;
  onClose: () => void;
}

export default function InviteModal({ householdId, onClose }: InviteModalProps) {
  const [activeTab, setActiveTab] = useState<'invite' | 'pending'>('invite');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const tabClass = (tab: 'invite' | 'pending') =>
    `${
      activeTab === tab
        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
          <button type="button" className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" onClick={onClose} aria-label="Close">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h3 id="invite-modal-title" className="text-lg font-medium leading-6 text-gray-900 dark:text-white pr-8">
            Invite roommates
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Send an invitation link, or share the household join code from your dashboard.</p>

          <div className="mt-4 border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button type="button" onClick={() => setActiveTab('invite')} className={tabClass('invite')}>
                New invitation
              </button>
              <button type="button" onClick={() => setActiveTab('pending')} className={tabClass('pending')}>
                Pending
              </button>
            </nav>
          </div>

          <div className="mt-4">
            {activeTab === 'invite' ? (
              <InvitationForm householdId={householdId} onInviteSent={() => setRefreshTrigger((n) => n + 1)} />
            ) : (
              <PendingInvitations key={refreshTrigger} householdId={householdId} onRefresh={() => setRefreshTrigger((n) => n + 1)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
