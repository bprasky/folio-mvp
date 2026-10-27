'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from '@/components/FolioImage';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { REQUEST_TYPE_OPTIONS } from '@/types/structured-requests';
import type { RepResolutionResult } from '@/types/structured-requests';

interface FolioUser {
  id: string;
  name: string;
  email: string;
  role: string;
  profileImage: string | null;
  studio: string | null;
}

interface RepResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  vendorName: string;
  actionType: 'SAMPLE_REQUEST' | 'QUOTE_REQUEST' | 'GENERAL';
  /** Called when user selects a rep on Folio */
  onRepSelected: (repUserId: string, requestTypes: string[]) => void;
  /** Called after email is sent to an off-platform rep */
  onEmailSent: (result: { repName: string; repEmail: string; conversationId: string }) => void;
}

type Step = 'loading' | 'search' | 'compose';

export default function RepResolverModal({
  isOpen,
  onClose,
  productId,
  productName,
  vendorName,
  actionType,
  onRepSelected,
  onEmailSent,
}: RepResolverModalProps) {
  const [step, setStep] = useState<Step>('loading');
  const [resolution, setResolution] = useState<RepResolutionResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<RepResolutionResult['orgMembers']>([]);

  // Compose step state
  const [requestTypes, setRequestTypes] = useState<string[]>([actionType]);
  const [repName, setRepName] = useState('');
  const [repEmail, setRepEmail] = useState('');
  const [messagePreview, setMessagePreview] = useState('');
  const [sending, setSending] = useState(false);

  // Folio search state
  const [folioResults, setFolioResults] = useState<FolioUser[]>([]);
  const [selectedFolioUser, setSelectedFolioUser] = useState<FolioUser | null>(null);
  const [searchingFolio, setSearchingFolio] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRequestTypes([actionType]);
      setRepName('');
      setRepEmail('');
      setMessagePreview('');
      setFolioResults([]);
      setSelectedFolioUser(null);
      setShowDropdown(false);
      resolveRep();
    }
  }, [isOpen, productId]);

  // Generate message preview when inputs change
  const generatePreview = useCallback(() => {
    const name = selectedFolioUser?.name || repName || 'there';
    const typeLabels: Record<string, string> = {
      SAMPLE_REQUEST: 'Product sample',
      QUOTE_REQUEST: 'Quote/pricing',
      LEAD_TIME_REQUEST: 'Lead time information',
      PHOTO_REQUEST: 'Product photos/tearsheets',
      SPEC_REQUEST: 'Specs/technical data',
    };
    const requestList = requestTypes
      .map(t => `- ${typeLabels[t] || t}`)
      .join('\n');

    return `Hi ${name},

I'm reaching out regarding the ${productName} by ${vendorName}.

I'd like to request the following:
${requestList}

Please let me know if you need any additional details.

Best`;
  }, [requestTypes, repName, selectedFolioUser, productName, vendorName]);

  useEffect(() => {
    if (step === 'compose') {
      setMessagePreview(generatePreview());
    }
  }, [step, requestTypes, repName, selectedFolioUser, generatePreview]);

  // Debounced Folio user search
  useEffect(() => {
    if (selectedFolioUser) return; // Don't search when user already selected

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (repName.trim().length < 2) {
      setFolioResults([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchingFolio(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(repName.trim())}&limit=5`);
        const data = await res.json();
        setFolioResults(data.users || []);
        setShowDropdown((data.users || []).length > 0);
      } catch {
        setFolioResults([]);
      } finally {
        setSearchingFolio(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [repName, selectedFolioUser]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
        onRepSelected(data.rep.userId, [actionType]);
        onClose();
        return;
      }

      if (data.status === 'ORG_MEMBERS' && data.orgMembers) {
        setMembers(data.orgMembers);
        setStep('search');
      } else {
        // Pre-fill from preferred contact if available
        if (data.preferredContact) {
          setRepName(data.preferredContact.name);
          setRepEmail(data.preferredContact.email);
        }
        setStep('compose');
      }
    } catch {
      setStep('compose');
    }
  };

  const filteredMembers = (members || []).filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectFolioUser = (user: FolioUser) => {
    setSelectedFolioUser(user);
    setRepName(user.name);
    setRepEmail('');
    setShowDropdown(false);
  };

  const handleClearFolioUser = () => {
    setSelectedFolioUser(null);
    setRepName('');
    setRepEmail('');
    setFolioResults([]);
  };

  const toggleRequestType = (type: string) => {
    setRequestTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSubmit = async () => {
    if (requestTypes.length === 0) return;

    setSending(true);
    try {
      if (selectedFolioUser) {
        // On-platform: pass to parent to handle via request API
        onRepSelected(selectedFolioUser.id, requestTypes);
        onClose();
      } else {
        // Off-platform: send email via Folio
        if (!repEmail.trim()) return;

        const res = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionType: requestTypes[0],
            productId,
            recipientEmail: repEmail.trim(),
            recipientName: repName.trim(),
            requestTypes,
            payload: {
              type: requestTypes[0],
              productId,
              productName,
              vendorName,
              requestTypes,
              customMessage: messagePreview,
            },
          }),
        });

        const data = await res.json();
        if (res.ok && data.conversationId) {
          onEmailSent({
            repName: repName.trim(),
            repEmail: repEmail.trim(),
            conversationId: data.conversationId,
          });
          onClose();
        } else {
          toast.error('Failed to send email. Please try again.');
        }
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const canSubmit = requestTypes.length > 0 && (
    selectedFolioUser || (repName.trim() && repEmail.trim())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl max-h-[90vh] overflow-y-auto">

        {step === 'loading' && (
          <div className="py-8 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent)]" />
            <p className="mt-2 text-sm text-folio-text-secondary">Finding your rep...</p>
          </div>
        )}

        {step === 'search' && (
          <>
            <h3 className="folio-h3 text-folio-text-primary mb-1">
              Find your rep at {resolution?.vendorOrgName || vendorName}
            </h3>
            <p className="text-sm text-folio-text-secondary mb-4">
              Select who should receive your request for {productName}.
            </p>

            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name..."
              className="w-full px-3 py-2 mb-3 bg-white border border-folio-border-subtle rounded-lg text-folio-text-primary placeholder-[#A39E97] focus:outline-none focus:border-folio-border-strong transition-all"
            />

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredMembers.map(member => (
                <button
                  key={member.userId}
                  onClick={() => { onRepSelected(member.userId, [actionType]); onClose(); }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-ground transition-colors text-left"
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
                    <div className="w-9 h-9 rounded-full bg-surface-ground flex items-center justify-center text-sm font-medium text-folio-text-secondary">
                      {member.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-folio-text-primary">{member.name}</div>
                    <div className="text-xs text-folio-text-tertiary capitalize">{member.role.toLowerCase()}</div>
                  </div>
                  <span className="ml-auto text-xs text-[var(--accent)]">Send to</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep('compose')}
              className="w-full mt-3 text-sm text-[var(--accent)] hover:underline text-center"
            >
              Don&apos;t see your rep? Send a request directly
            </button>
          </>
        )}

        {step === 'compose' && (
          <>
            <h3 className="folio-h3 text-folio-text-primary mb-1">
              Send request to rep
            </h3>
            <p className="text-sm text-folio-text-secondary mb-4">
              {vendorName} &middot; {productName}
            </p>

            {/* Request type checkboxes */}
            <div className="mb-4">
              <label className="block text-sm text-folio-text-tertiary mb-2 font-medium">
                What would you like to request?
              </label>
              <div className="flex flex-wrap gap-2">
                {REQUEST_TYPE_OPTIONS.map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors border ${
                      requestTypes.includes(opt.value)
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-white text-folio-text-secondary border-folio-border-subtle hover:border-folio-border-strong'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={requestTypes.includes(opt.value)}
                      onChange={() => toggleRequestType(opt.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Rep name with Folio search */}
            <div className="mb-3 relative" ref={dropdownRef}>
              <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">
                Rep&apos;s name
              </label>
              {selectedFolioUser ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-folio-border-subtle rounded-lg">
                  {selectedFolioUser.profileImage ? (
                    <Image
                      src={selectedFolioUser.profileImage}
                      alt={selectedFolioUser.name}
                      width={24}
                      height={24}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-surface-ground flex items-center justify-center text-xs font-medium text-folio-text-secondary">
                      {selectedFolioUser.name.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm text-folio-text-primary font-medium">{selectedFolioUser.name}</span>
                  <span className="text-xs text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded">on Folio</span>
                  <button
                    onClick={handleClearFolioUser}
                    className="ml-auto text-folio-text-tertiary hover:text-folio-text-secondary text-sm"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={repName}
                    onChange={(e) => setRepName(e.target.value)}
                    placeholder="Search Folio or enter name..."
                    className="w-full px-3 py-2 bg-white border border-folio-border-subtle rounded-lg text-folio-text-primary placeholder-[#A39E97] focus:outline-none focus:border-folio-border-strong transition-all"
                  />
                  {searchingFolio && (
                    <div className="absolute right-3 top-[calc(50%+4px)] -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--accent)]" />
                    </div>
                  )}
                  {/* Folio search dropdown */}
                  {showDropdown && folioResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-folio-border-subtle rounded-lg shadow-lg overflow-hidden">
                      {folioResults.map(user => (
                        <button
                          key={user.id}
                          onClick={() => handleSelectFolioUser(user)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-surface-ground transition-colors text-left border-b border-folio-border-subtle last:border-b-0"
                        >
                          {user.profileImage ? (
                            <Image
                              src={user.profileImage}
                              alt={user.name}
                              width={28}
                              height={28}
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-surface-ground flex items-center justify-center text-xs font-medium text-folio-text-secondary">
                              {user.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-folio-text-primary">{user.name}</div>
                            <div className="text-xs text-folio-text-tertiary">
                              {user.studio || user.email}
                            </div>
                          </div>
                          <span className="ml-auto text-xs text-[var(--accent)]">on Folio</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Email field - only for off-platform reps */}
            {!selectedFolioUser && (
              <div className="mb-3">
                <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">
                  Rep&apos;s email
                </label>
                <input
                  type="email"
                  value={repEmail}
                  onChange={(e) => setRepEmail(e.target.value)}
                  placeholder="jane@vendor.com"
                  className="w-full px-3 py-2 bg-white border border-folio-border-subtle rounded-lg text-folio-text-primary placeholder-[#A39E97] focus:outline-none focus:border-folio-border-strong transition-all"
                />
              </div>
            )}

            {/* Message preview */}
            {!selectedFolioUser && (
              <div className="mb-4">
                <label className="block text-sm text-folio-text-tertiary mb-1 font-medium">
                  Message preview
                </label>
                <textarea
                  value={messagePreview}
                  onChange={(e) => setMessagePreview(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 bg-white border border-folio-border-subtle rounded-lg text-folio-text-primary text-sm focus:outline-none focus:border-folio-border-strong transition-all resize-none"
                />
              </div>
            )}

            {/* Submit button */}
            <Button
              variant="accent"
              onClick={handleSubmit}
              disabled={!canSubmit || sending}
              className="w-full"
            >
              {sending ? 'Sending...' : 'Submit Request'}
            </Button>

            {!selectedFolioUser && repEmail.trim() && (
              <p className="text-xs text-folio-text-tertiary mt-2 text-center">
                Folio sends the email on your behalf. Replies come back to your Folio inbox.
              </p>
            )}

            {members && members.length > 0 && (
              <button
                onClick={() => setStep('search')}
                className="w-full mt-3 text-sm text-folio-text-tertiary hover:text-folio-text-secondary text-center"
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
