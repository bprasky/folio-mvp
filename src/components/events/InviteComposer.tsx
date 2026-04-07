"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import CSVUploader from './invites/CSVUploader';
import EmailListInput from './invites/EmailListInput';
import SavedListsSelector from './invites/SavedListsSelector';
import GraphTargetingPanel from './invites/GraphTargetingPanel';
import AutoSuggestionsPanel from './invites/AutoSuggestionsPanel';

interface InviteComposerProps {
  eventId: string;
  onInvitesSent?: (count: number) => void;
}

export default function InviteComposer({ eventId, onInvitesSent }: InviteComposerProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'upload' | 'email' | 'saved' | 'targeting' | 'suggestions'>('upload');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tabs = [
    { id: 'upload', label: 'CSV Upload' },
    { id: 'email', label: 'Email List' },
    { id: 'saved', label: 'Saved Lists' },
    { id: 'targeting', label: 'Graph Targeting' },
    { id: 'suggestions', label: 'AI Suggestions' },
  ];

  return (
    <div className="bg-surface-canvas rounded-xl border border-folio-border-subtle shadow-sm">
      {/* Tabs */}
      <div className="border-b border-folio-border-subtle">
        <div className="flex space-x-1 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-ink border-b-2 border-accent-700'
                  : 'text-folio-text-tertiary hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'upload' && (
          <CSVUploader eventId={eventId} onSuccess={onInvitesSent} />
        )}
        {activeTab === 'email' && (
          <EmailListInput eventId={eventId} onSuccess={onInvitesSent} />
        )}
        {activeTab === 'saved' && (
          <SavedListsSelector eventId={eventId} onSuccess={onInvitesSent} />
        )}
        {activeTab === 'targeting' && (
          <GraphTargetingPanel eventId={eventId} onSuccess={onInvitesSent} />
        )}
        {activeTab === 'suggestions' && (
          <AutoSuggestionsPanel eventId={eventId} onSuccess={onInvitesSent} />
        )}
      </div>
    </div>
  );
}




