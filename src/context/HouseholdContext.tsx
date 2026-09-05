// src/context/HouseholdContext.tsx
// Which household the dashboard is looking at. Most people belong to one; the choice is kept in
// localStorage so switching sticks between visits.
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/api-client';
import { fetchHouseholds } from '@/lib/services/households';
import type { HouseholdSummary } from '@/types';

const STORAGE_KEY = 'roomies.currentHouseholdId';

interface HouseholdContextValue {
  households: HouseholdSummary[];
  current: HouseholdSummary | null;
  currentId: string | null;
  setCurrentId: (id: string) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined);

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode etc. — the in-memory value still works for this visit.
  }
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const list = await fetchHouseholds();
      setHouseholds(list);
      setCurrentIdState((previous) => {
        const preferred = previous ?? readStored();
        return list.some((h) => h.id === preferred) ? preferred : (list[0]?.id ?? null);
      });
    } catch (err) {
      setError(errorMessage(err, 'Failed to load your households'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setHouseholds([]);
      setCurrentIdState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [user, authLoading, refresh]);

  const setCurrentId = useCallback((id: string) => {
    setCurrentIdState(id);
    writeStored(id);
  }, []);

  const value = useMemo<HouseholdContextValue>(
    () => ({
      households,
      current: households.find((h) => h.id === currentId) ?? null,
      currentId,
      setCurrentId,
      loading: loading || authLoading,
      error,
      refresh,
    }),
    [households, currentId, setCurrentId, loading, authLoading, error, refresh]
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): HouseholdContextValue {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
}
