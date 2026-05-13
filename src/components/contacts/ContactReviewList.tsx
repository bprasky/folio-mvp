'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ContactRecord {
  id: string;
  name: string;
  email: string;
  company: string | null;
  title: string | null;
  vendorOrgId: string | null;
  vendorName: string | null;
  matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED' | null;
  isPreferredRep: boolean;
}

interface VendorGroup {
  vendorName: string;
  vendorOrgId: string | null;
  contacts: ContactRecord[];
}

interface ContactReviewListProps {
  vendorGroups: VendorGroup[];
  onConfirm: (preferredRepIds: string[]) => void;
  onSkip: () => void;
}

const CONFIDENCE_LABELS: Record<string, string> = {
  HIGH: 'Email domain match',
  MEDIUM: 'Company name match (your vendor)',
  LOW: 'Company name match (catalog)',
};

const CONFIDENCE_STYLES: Record<string, { bg: string; color: string }> = {
  HIGH: { bg: '#E8F5E9', color: '#2E7D32' },
  MEDIUM: { bg: '#FFF8E1', color: '#F57F17' },
  LOW: { bg: '#F3F0ED', color: '#8B8178' },
};

export default function ContactReviewList({
  vendorGroups,
  onConfirm,
  onSkip,
}: ContactReviewListProps) {
  // Track which contacts are selected as preferred rep (pre-select first HIGH/MEDIUM contact per group)
  const [selectedReps, setSelectedReps] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const group of vendorGroups) {
      const conf = group.contacts[0]?.matchConfidence;
      if (conf === 'HIGH' || conf === 'MEDIUM') {
        // Pre-select the first contact that looks like a real rep (not generic)
        const repContact = group.contacts.find(c => !isGenericEmail(c.email));
        if (repContact) initial.add(repContact.id);
      }
    }
    return initial;
  });

  const toggleRep = (contactId: string, vendorGroupKey: string) => {
    setSelectedReps(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        // Remove any other selected rep in the same vendor group
        const group = vendorGroups.find(g => g.vendorName === vendorGroupKey);
        if (group) {
          for (const c of group.contacts) {
            next.delete(c.id);
          }
        }
        next.add(contactId);
      }
      return next;
    });
  };

  const matchedGroups = vendorGroups.filter(g =>
    g.contacts.some(c => c.matchConfidence === 'HIGH' || c.matchConfidence === 'MEDIUM')
  );

  const otherGroups = vendorGroups.filter(g =>
    g.contacts.every(c => c.matchConfidence === 'LOW')
  );

  return (
    <div className="space-y-6">
      <h2 className="folio-h2 text-folio-text-primary">
        We Found Your Vendor Contacts
      </h2>

      {matchedGroups.length > 0 && (
        <div>
          <p className="text-xs font-medium text-folio-text-tertiary uppercase tracking-wider mb-3">
            Your Vendors
          </p>
          <div className="space-y-3">
            {matchedGroups.map(group => (
              <VendorGroupCard
                key={group.vendorName}
                group={group}
                selectedReps={selectedReps}
                onToggleRep={toggleRep}
              />
            ))}
          </div>
        </div>
      )}

      {otherGroups.length > 0 && (
        <div>
          <p className="text-xs font-medium text-folio-text-tertiary uppercase tracking-wider mb-3">
            Other Vendor Matches
          </p>
          <div className="space-y-3">
            {otherGroups.map(group => (
              <VendorGroupCard
                key={group.vendorName}
                group={group}
                selectedReps={selectedReps}
                onToggleRep={toggleRep}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button
          variant="accent"
          onClick={() => onConfirm(Array.from(selectedReps))}
          disabled={selectedReps.size === 0}
        >
          Import Selected ({selectedReps.size})
        </Button>
        <Button variant="ridge" onClick={onSkip}>
          Skip for Now
        </Button>
      </div>
    </div>
  );
}

function VendorGroupCard({
  group,
  selectedReps,
  onToggleRep,
}: {
  group: VendorGroup;
  selectedReps: Set<string>;
  onToggleRep: (contactId: string, vendorKey: string) => void;
}) {
  const confidence = group.contacts[0]?.matchConfidence || 'UNMATCHED';
  const style = CONFIDENCE_STYLES[confidence] || CONFIDENCE_STYLES.LOW;

  return (
    <div className="glass-surface rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-folio-text-primary">
          {group.vendorName}
        </h3>
        <span
          className="text-[var(--type-fine)] px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {CONFIDENCE_LABELS[confidence] || 'Match'}
        </span>
      </div>

      <div className="space-y-2">
        {group.contacts.map(contact => {
          const isSelected = selectedReps.has(contact.id);
          const isGeneric = isGenericEmail(contact.email);

          return (
            <label
              key={contact.id}
              className="flex items-center gap-3 py-2 cursor-pointer rounded-lg px-2 hover:bg-surface-ground transition-colors"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleRep(contact.id, group.vendorName)}
                className="rounded border-folio-border-strong text-folio-text-primary focus:ring-[var(--accent)]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-folio-text-primary">
                  {contact.name}
                  {isGeneric && (
                    <span className="text-[var(--type-fine)] text-folio-text-tertiary ml-2">General</span>
                  )}
                </p>
                <p className="text-xs text-folio-text-tertiary truncate">
                  {contact.email}
                  {contact.title && ` · ${contact.title}`}
                </p>
              </div>
              {isSelected && (
                <span className="text-[var(--type-fine)] px-1.5 py-0.5 rounded-full bg-folio-text-primary text-white whitespace-nowrap">
                  My Rep
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function isGenericEmail(email: string): boolean {
  const local = email.split('@')[0].toLowerCase();
  return ['info', 'orders', 'sales', 'reception', 'contact', 'support', 'hello', 'team'].includes(local);
}
