'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CoverageManager } from '@/components/coverage/CoverageManager';
import InviteTeamModal from './InviteTeamModal';
import OrgCoverEditor from './OrgCoverEditor';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import styles from './OrgProfileAppearance.module.css';

export type ProfileNextStep = { title: string; description: string; href: string; action: string };

export function StudioProfileTools({ orgId, next, isAdmin, canInvite, children }: {
  orgId: string; next: ProfileNextStep | null; isAdmin: boolean; canInvite: boolean; children: ReactNode;
}) {
  const [invite, setInvite] = useState(false);
  const [open, setOpen] = useState(false);
  const profileUrl = '/org/' + orgId;
  return <div className={styles.inlineControls}>
    {isAdmin && <OrgCoverEditor orgId={orgId} />}
    <button type="button" className={styles.manageTrigger} onClick={() => setOpen(true)}>Manage profile</button>
    <Dialog open={open} onOpenChange={setOpen} placement="right">
      <DialogContent placement="right" className={styles.manageSheet}>
        <div className={styles.sheetHeader}><div><DialogTitle>Manage your profile</DialogTitle><DialogDescription>Your public profile stays focused on your work.</DialogDescription></div>
          <button type="button" className={styles.textButton} onClick={() => setOpen(false)}>Close</button></div>
        <div className="p-6 space-y-7">
    {next && <div className={styles.nextStep}>
      <div><p className={styles.workspaceLabel}>Your next step</p>
        <h2>{next.title}</h2><p>{next.description}</p></div>
      <Link className={styles.nextAction} href={next.href}>{next.action}<span aria-hidden="true">→</span></Link>
    </div>}
    {(isAdmin || canInvite) && <div>
      <div className={styles.manageLinks}>
        {isAdmin && <>
          <Link href={profileUrl + '/edit'}>Edit studio information</Link>
          <Link href={profileUrl + '/settings#appearance'}>Customize page</Link>
          <CoverageManager scope={{ type: 'organization', id: orgId }} compact />
          <Link href={`/onboarding/workspace?orgId=${orgId}`}>Review website import</Link>
          <Link href="/projects">Project workspace</Link>
        </>}
        {canInvite && <button type="button" onClick={() => setInvite(true)}>Invite your team</button>}
      </div>
      {children}
    </div>}
        </div>
      </DialogContent>
    </Dialog>
    {canInvite && <InviteTeamModal orgId={orgId} open={invite} onOpenChange={setInvite} />}
  </div>;
}
