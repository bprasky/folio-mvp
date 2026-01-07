"use client";

import { useState, useEffect } from 'react';
import { List, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface SavedListsSelectorProps {
  eventId: string;
  onSuccess?: (count: number) => void;
}

interface InviteList {
  id: string;
  name: string;
  description?: string;
  listType: string;
  contactIds: string[];
  timesUsed: number;
  isPremium: boolean;
  priceUsd?: number;
}

export default function SavedListsSelector({ eventId, onSuccess }: SavedListsSelectorProps) {
  const [lists, setLists] = useState<InviteList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);

  useEffect(() => {
    fetchLists();
  }, [eventId]);

  const fetchLists = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/invites/lists`);
      const data = await response.json();
      if (response.ok) {
        setLists(data.lists || []);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseList = async () => {
    if (!selectedListId) return;

    const selectedList = lists.find((l) => l.id === selectedListId);
    if (!selectedList) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch(`/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: selectedList.contactIds.map((id) => ({ email: id })), // Simplified - in real app, fetch full contact data
          inviteListId: selectedListId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, count: data.created });
        onSuccess?.(data.created);
        setSelectedListId(null);
      } else {
        setResult({ success: false, error: data.error || 'Failed to use list' });
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message || 'Failed to use list' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-ink mb-2">Select Saved List</h3>
        <p className="text-sm text-stone-500 mb-4">
          Choose from your previously saved invite lists
        </p>
      </div>

      {lists.length === 0 ? (
        <div className="text-center py-8 text-stone-500">
          <List className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No saved lists yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map((list) => (
            <label
              key={list.id}
              className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedListId === list.id
                  ? 'border-accent-700 bg-accent-50'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <input
                type="radio"
                name="list"
                value={list.id}
                checked={selectedListId === list.id}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="sr-only"
              />
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-ink">{list.name}</h4>
                    {list.isPremium && (
                      <span className="text-xs px-2 py-0.5 bg-accent-200 text-accent-700 rounded">
                        Premium
                      </span>
                    )}
                  </div>
                  {list.description && (
                    <p className="text-sm text-stone-500 mt-1">{list.description}</p>
                  )}
                  <div className="flex items-center space-x-4 mt-2 text-xs text-stone-400">
                    <span>{list.contactIds.length} contacts</span>
                    <span>Used {list.timesUsed} time{list.timesUsed !== 1 ? 's' : ''}</span>
                    {list.priceUsd && <span>${list.priceUsd.toFixed(2)}</span>}
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>
      )}

      {result && (
        <div
          className={`p-4 rounded-lg flex items-start space-x-3 ${
            result.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            {result.success ? (
              <p className="text-sm text-green-800">
                Successfully sent {result.count} invites
              </p>
            ) : (
              <p className="text-sm text-red-800">{result.error}</p>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleUseList}
        disabled={!selectedListId || isSubmitting}
        className="w-full px-4 py-2 bg-ink text-white rounded-lg font-medium hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Sending Invites...' : 'Use Selected List'}
      </button>
    </div>
  );
}




