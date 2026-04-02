'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import type { RepResolutionResult } from '@/types/structured-requests';

interface RepResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  vendorName: string;
  /** Called when user selects a rep — passes their userId */
  onRepSelected: (repUserId: string) => void;
  /** Called when user wants to invite a new rep */
  onInviteRep: (repName: string, repEmail: string, sendInvite: boolean) => void;
  /** Called when user wants to send email via Folio proxy instead of inviting */
  onSendViaFolio?: (recipientName: string, recipientEmail: string) => void;
}

type Step = 'loading' | 'search' | 'invite';

export default function RepResolverModal({
  isOpen,
  onClose,
  productId,
  productName,
  vendorName,
  onRepSelected,
  onInviteRep,
  onSendViaFolio,
}: RepResolverModalProps) {
  const [step, setStep] = useState<Step>('loading');
  const [resolution, setResolution] = useState<RepResolutionResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<RepResolutionResult['orgMembers']>([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      resolveRep();
    }
  }, [isOpen, productId]);

  const resolveRep = async () => {
    setStep('loading');
    try {
      const res = await fetch('/api/designer/sourcebook/resolve-rep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const data: RepResolutionResult = await res.json();
      setResolution(data);

      if (data.status === 'DIRECT_REP' && data.rep) {
        // Auto-select the rep
        onRepSelected(data.rep.userId);
        onClose();
        return;
      }

      if (data.status === 'ORG_MEMBERS' && data.orgMembers) {
        setMembers(data.orgMembers);
        setStep('search');
      } else {
        setStep('invite');
      }
    } catch {
      setStep('invite');
    }
  };

  const filteredMembers = (members || []).filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInvite = async (sendInvite: boolean) => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setSending(true);
    onInviteRep(inviteName.trim(), inviteEmail.trim(), sendInvite);
    setSending(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">

        {step === 'loading' && (
          <div className="py-8 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent)]" />
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Finding your rep...</p>
          </div>
        )}

        {step === 'search' && (
          <>
            <h3 className="folio-h3 text-[var(--text-primary)] mb-1">
              Find your rep at {resolution?.vendorOrgName || vendorName}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Select who should receive your request for {productName}.
            </p>

            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name..."
              className="w-full px-3 py-2 mb-3 bg-white border border-[#E8E6E3] rounded-lg text-[#2C2925] placeholder-[#A39E97] focus:outline-none focus:border-[#C9C4BC] transition-all"
            />

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredMembers.map(member => (
                <button
                  key={member.userId}
                  onClick={() => { onRepSelected(member.userId); onClose(); }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors text-left"
                >
                  {member.profileImage ? (
                    <Image
                      src={member.profileImage}
                      alt={member.name}
                      width={36}
                      height={36}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-sm font-medium text-[var(--text-secondary)]">
                      {member.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{member.name}</div>
                    <div className="text-xs text-[var(--text-tertiary)] capitalize">{member.role.toLowerCase()}</div>
                  </div>
                  <span className="ml-auto text-xs text-[var(--accent)]">Send to</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep('invite')}
              className="w-full mt-3 text-sm text-[var(--accent)] hover:underline text-center"
            >
              Don&apos;t see your rep? Invite them to Folio
            </button>
          </>
        )}

        {step === 'invite' && (
          <>
            <h3 className="folio-h3 text-[var(--text-primary)] mb-1">
              Invite your rep to Folio
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {vendorName}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[var(--text-tertiary)] mb-1 font-medium">Rep&apos;s name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2 bg-white border border-[#E8E6E3] rounded-lg text-[#2C2925] placeholder-[#A39E97] focus:outline-none focus:border-[#C9C4BC] transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-tertiary)] mb-1 font-medium">Rep&apos;s email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="jane@vendor.com"
                  className="w-full px-3 py-2 bg-white border border-[#E8E6E3] rounded-lg text-[#2C2925] placeholder-[#A39E97] focus:outline-none focus:border-[#C9C4BC] transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-5">
              {onSendViaFolio && (
                <Button
                  variant="accent"
                  onClick={() => {
                    if (inviteName.trim() && inviteEmail.trim()) {
                      onSendViaFolio(inviteName.trim(), inviteEmail.trim());
                      onClose();
                    }
                  }}
                  disabled={!inviteName.trim() || !inviteEmail.trim() || sending}
                  className="w-full"
                >
                  Send from Folio
                </Button>
              )}
              <Button
                variant={onSendViaFolio ? 'ridge' : 'accent'}
                onClick={() => handleInvite(true)}
                disabled={!inviteName.trim() || !inviteEmail.trim() || sending}
                className="w-full"
              >
                Send Folio Invite
              </Button>
              <Button
                variant="ridge"
                onClick={() => handleInvite(false)}
                disabled={!inviteName.trim() || !inviteEmail.trim() || sending}
                className="w-full"
              >
                Just send me the email template
              </Button>
            </div>

            {onSendViaFolio && (
              <p className="text-xs text-[var(--text-tertiary)] mt-2 text-center">
                Folio sends the email on your behalf. Replies come back to your Folio inbox.
              </p>
            )}

            {members && members.length > 0 && (
              <button
                onClick={() => setStep('search')}
                className="w-full mt-3 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] text-center"
              >
                Back to org members
              </button>
            )}
          </>
        )}

        <div className="flex justify-end mt-4">
          <Button variant="ridge" onClick={onClose} size="sm">Close</Button>
        </div>
      </div>
    </div>
  );
}
