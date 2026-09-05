// src/components/dashboard/HouseholdRequired.tsx
// Shown on household-scoped pages when the user has not created or joined one yet.
import { HiOutlineHomeModern } from 'react-icons/hi2';
import ButtonLink from '@/components/ui/ButtonLink';
import EmptyState from '@/components/ui/EmptyState';

export default function HouseholdRequired({ feature }: { feature: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <EmptyState
        icon={<HiOutlineHomeModern className="h-6 w-6" />}
        title="No household yet"
        description={`Create a household or join one with a code to start ${feature}.`}
        action={<ButtonLink href="/dashboard">Create or join a household</ButtonLink>}
      />
    </div>
  );
}
