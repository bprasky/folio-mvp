'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Designer {
  id: string;
  name: string;
  profileImage: string | null;
  studio: string | null;
}

interface CreateCollaborationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (storyId: string) => void;
}

export function CreateCollaborationModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateCollaborationModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Designer[]>([]);
  const [selectedDesigner, setSelectedDesigner] = useState<Designer | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState('');

  const searchDesigners = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&role=DESIGNER&limit=10`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data.users || []);
    } catch (error) {
      console.error('Failed to search designers:', error);
      toast.error('Failed to search designers');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedDesigner(null);

    // Debounced search
    const timeoutId = setTimeout(() => {
      searchDesigners(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleSelectDesigner = (designer: Designer) => {
    setSelectedDesigner(designer);
    setSearchQuery(designer.name);
    setSearchResults([]);
  };

  const handleCreate = async () => {
    if (!selectedDesigner) {
      toast.error('Please select a designer');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/collaboration/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designerUserId: selectedDesigner.id,
          message: message || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create collaboration');
      }

      const story = await res.json();
      toast.success(`Invitation sent to ${selectedDesigner.name}`);
      onOpenChange(false);
      onSuccess?.(story.id);

      // Reset form
      setSearchQuery('');
      setSelectedDesigner(null);
      setMessage('');
    } catch (error: any) {
      console.error('Failed to create collaboration:', error);
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Collaboration Story</DialogTitle>
          <DialogDescription>
            Invite a designer to create a collaboration story together.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Designer Search */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Find a Designer
            </label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && !selectedDesigner && (
              <div className="absolute z-10 w-full mt-1 bg-surface-canvas rounded-lg border border-neutral-200 shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((designer) => (
                  <button
                    key={designer.id}
                    onClick={() => handleSelectDesigner(designer)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-neutral-50 transition-colors text-left"
                  >
                    {designer.profileImage ? (
                      <img
                        src={designer.profileImage}
                        alt={designer.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center">
                        <span className="text-neutral-600 text-sm font-medium">
                          {designer.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-neutral-900">{designer.name}</p>
                      {designer.studio && (
                        <p className="text-sm text-neutral-500">{designer.studio}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Designer Preview */}
          {selectedDesigner && (
            <div className="p-4 bg-neutral-50 rounded-lg flex items-center gap-3">
              {selectedDesigner.profileImage ? (
                <img
                  src={selectedDesigner.profileImage}
                  alt={selectedDesigner.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-neutral-200 flex items-center justify-center">
                  <span className="text-neutral-600 font-medium">
                    {selectedDesigner.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium text-neutral-900">{selectedDesigner.name}</p>
                {selectedDesigner.studio && (
                  <p className="text-sm text-neutral-500">{selectedDesigner.studio}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedDesigner(null);
                  setSearchQuery('');
                }}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Optional Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700">
              Invitation Message <span className="text-neutral-400">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note to your invitation..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg resize-none h-20 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              maxLength={500}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!selectedDesigner || isCreating}
              className="flex-1"
            >
              {isCreating ? 'Sending...' : 'Send Invitation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
