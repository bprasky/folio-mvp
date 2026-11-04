'use client';

import { useRef } from 'react';
import { workflowRequest } from '@/lib/client/workflowRequest';
import type { ImportSection } from './types';

type ImportRequest = {
  orgId: string;
  website: string;
  sections: ImportSection[];
  projectUrls?: string[];
  consent: boolean;
  returnTo: string;
};

/** Replay an unconfirmed start with the same receipt until its inputs change. */
export function useStartWorkspaceImport() {
  const receipt = useRef<{ body: string; id: string }>();
  return async (input: ImportRequest): Promise<string> => {
    const body = JSON.stringify(input);
    if (receipt.current?.body !== body) receipt.current = { body, id: crypto.randomUUID() };
    const response = await workflowRequest('/api/onboarding/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, requestId: receipt.current.id }),
    });
    const data = await response.json();
    if (!response.ok || !data.id) throw new Error(data.error || 'Could not start your import.');
    return data.id;
  };
}
