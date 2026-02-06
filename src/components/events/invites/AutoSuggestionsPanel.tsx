"use client";

import { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface AutoSuggestionsPanelProps {
  eventId: string;
  onSuccess?: (count: number) => void;
}

export default function AutoSuggestionsPanel({ eventId, onSuccess }: AutoSuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, [eventId]);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/ai/recommendations?type=guests`);
      const data = await response.json();
      if (response.ok) {
        setSuggestions(data.recommendations?.guests || []);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSuggestion = (designerId: string) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(designerId)) {
      newSelected.delete(designerId);
    } else {
      newSelected.add(designerId);
    }
    setSelectedSuggestions(newSelected);
  };

  const handleSendInvites = async () => {
    if (selectedSuggestions.size === 0) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const selectedContacts = suggestions
        .filter((s) => selectedSuggestions.has(s.designer.id))
        .map((s) => ({
          email: s.designer.email,
          name: s.designer.name,
          role: 'DESIGNER',
          source: 'ai_suggestion',
        }));

      const response = await fetch(`/api/events/${eventId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: selectedContacts }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, count: data.created });
        onSuccess?.(data.created);
        setSelectedSuggestions(new Set());
      } else {
        setResult({ success: false, error: data.error || 'Failed to send invites' });
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message || 'Failed to send invites' });
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
        <h3 className="text-lg font-medium text-ink mb-2">AI-Powered Suggestions</h3>
        <p className="text-sm text-stone-500 mb-4">
          Get intelligent recommendations based on engagement patterns and event context
        </p>
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-8 text-stone-500">
          <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No suggestions available</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <label
                key={suggestion.designer.id}
                className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedSuggestions.has(suggestion.designer.id)
                    ? 'border-accent-700 bg-accent-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedSuggestions.has(suggestion.designer.id)}
                  onChange={() => toggleSuggestion(suggestion.designer.id)}
                  className="sr-only"
                />
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-ink">{suggestion.designer.name}</h4>
                    <p className="text-sm text-stone-500 mt-1">{suggestion.reason}</p>
                    {suggestion.designer.location && (
                      <p className="text-xs text-stone-400 mt-1">{suggestion.designer.location}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      suggestion.priority === 'high'
                        ? 'bg-red-100 text-red-700'
                        : suggestion.priority === 'medium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-[var(--accent)]/10 text-[var(--accent-hover)]'
                    }`}
                  >
                    {suggestion.priority}
                  </span>
                </div>
              </label>
            ))}
          </div>

          {selectedSuggestions.size > 0 && (
            <div className="border-t border-stone-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-ink">
                  {selectedSuggestions.size} contact{selectedSuggestions.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={handleSendInvites}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Send Invites'}
                </button>
              </div>
            </div>
          )}
        </>
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
    </div>
  );
}




