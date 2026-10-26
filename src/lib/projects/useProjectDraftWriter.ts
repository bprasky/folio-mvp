'use client';
import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { createProjectDraftWriter } from './saveProjectDraft';

export function useProjectDraftWriter(entry: string) {
  const { data: session } = useSession();
  const actor = session?.user?.id;
  const org = session?.user?.operatingAsOrgId;
  return useMemo(() => createProjectDraftWriter(undefined, `folio:create:${actor}:${org}:${entry}`), [actor, org, entry]);
}
