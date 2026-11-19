'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CoverageManager } from '@/components/coverage/CoverageManager';
import InviteTeamModal from './InviteTeamModal';
import styles from './OrgProfileAppearance.module.css';

export type ProfileNextStep = { title: string; description: string; href: string; action: string };

export function StudioProfileTools({ orgId, next, isAdmin, canInvite, children }: {
  orgId: string; next: ProfileNextStep | null; isAdmin: boolean; canInvite: boolean; children: ReactNode;
}) {
  const [invite, setInvite] = useState(false);
  const profileUrl = '/org/' + orgId;
  return <aside className={styles.workspace} aria-label="Studio workspace">
    {next && <div className={styles.nextStep}>
      <div><p className={styles.workspaceLabel}>Your next step</p>
        <h2>{next.title}</h2><p>{next.description}</p></div>
      <Link className={styles.nextAction} href={next.href}>{next.action}<span aria-hidden="true">→</span></Link>
    </div>}
    {(isAdmin || canInvite) && <details className={styles.toolsDisclosure}>
      <summary>Manage profile</summary>
      <div className={styles.toolLinks}>
        {isAdmin && <>
          <Link href={profileUrl + '/edit'}>Edit profile</Link>
          <Link href={profileUrl + '/settings#appearance'}>Customize page</Link>
          <CoverageManager scope={{ type: 'organization', id: orgId }} compact />
        </>}
        {canInvite && <button type="button" onClick={() => setInvite(true)}>Invite your team</button>}
      </div>
      {children}
    </details>}
    {canInvite && <InviteTeamModal orgId={orgId} open={invite} onOpenChange={setInvite} />}
  </aside>;
}
