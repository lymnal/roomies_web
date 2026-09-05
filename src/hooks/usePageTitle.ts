// src/hooks/usePageTitle.ts
'use client';

import { useEffect } from 'react';

/** Client pages cannot export Next metadata, so set the tab title from an effect. */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Roomies` : 'Roomies';
  }, [title]);
}
