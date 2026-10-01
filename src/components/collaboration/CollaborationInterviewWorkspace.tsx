'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CollaborationInvite } from './CollaborationInvite';
import { InterviewRound } from './InterviewRound';

export function CollaborationInterviewWorkspace({ storyId, role, status, vendorOrg, designerName, invitedAt }: {
  storyId: string; role: 'vendor' | 'designer'; status: string; designerName: string; invitedAt: string;
  vendorOrg: { id: string; name: string; logo: string | null; description: string | null };
}) {
  const router = useRouter();
  const [round, setRound] = useState<1 | 2 | 3>(1);
  const [liveActive, setLiveActive] = useState(false);
  if (status === 'INVITED') return role === 'designer' ? <CollaborationInvite storyId={storyId} vendorOrg={vendorOrg} invitedAt={invitedAt} onRespond={() => router.refresh()} />
    : <p className="folio-body">Waiting for {designerName} to accept the collaboration invitation.</p>;
  if (status === 'DECLINED') return <p className="folio-body">This collaboration invitation was declined.</p>;
  return <section className="space-y-6"><h1 className="folio-h2">{vendorOrg.name} × {designerName}</h1>
    <p className="folio-body">Your contribution stays in the existing collaboration review and approval flow.</p>
    <nav aria-label="Interview round" className="flex gap-4">{([1, 2, 3] as const).map(value => <button key={value} disabled={liveActive} aria-current={round === value ? 'step' : undefined}
      className="folio-ui underline disabled:opacity-50" onClick={() => setRound(value)}>Round {value}</button>)}</nav>
    <InterviewRound key={round} storyId={storyId} round={round} role={role === 'vendor' ? 'VENDOR' : 'DESIGNER'}
      otherPartyName={role === 'vendor' ? designerName : vendorOrg.name} onComplete={() => router.refresh()} onLiveActiveChange={setLiveActive} />
  </section>;
}
