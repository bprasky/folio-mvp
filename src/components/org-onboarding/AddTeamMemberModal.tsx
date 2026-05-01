'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Mail, UserPlus, Loader2 } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/useDebounce';

interface AddTeamMemberModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  orgName: string;
  onSuccess: () => void;
}

type AddMethod = 'search' | 'invite' | 'manual';

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  profileImage?: string;
  role?: string;
}

export function AddTeamMemberModal({
  open,
  onClose,
  orgId,
  orgName,
  onSuccess
}: AddTeamMemberModalProps) {
  const [method, setMethod] = useState<AddMethod>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [manualName, setManualName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Search for users
  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(debouncedSearch)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    };

    search();
  }, [debouncedSearch]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      let endpoint = `/api/orgs/${orgId}/team`;
      let body: Record<string, unknown> = { role: memberRole };

      if (method === 'search' && selectedUser) {
        body.userId = selectedUser.id;
      } else if (method === 'invite') {
        body.email = inviteEmail;
        endpoint = `/api/orgs/${orgId}/team/invite`;
      } else if (method === 'manual') {
        body.name = manualName;
        body.isManual = true;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add team member');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Add team member error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled =
    isSubmitting ||
    !memberRole ||
    (method === 'search' && !selectedUser) ||
    (method === 'invite' && !inviteEmail) ||
    (method === 'manual' && !manualName);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Georgia, serif' }}>Add Team Member</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {error && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'rgb(220, 38, 38)' }}
            >
              {error}
            </div>
          )}

          {/* Method Selection */}
          <div className="space-y-3">
            <MethodOption
              selected={method === 'search'}
              onClick={() => setMethod('search')}
              icon={<Search className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />}
              title="Find on Folio"
              description="Search by name or email"
            />

            <MethodOption
              selected={method === 'invite'}
              onClick={() => setMethod('invite')}
              icon={<Mail className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />}
              title="Invite via Email"
              description="They'll create an account and join your team"
            />

            <MethodOption
              selected={method === 'manual'}
              onClick={() => setMethod('manual')}
              icon={<UserPlus className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />}
              title="Add Manually"
              description="For team members who won't use the platform"
            />
          </div>

          {/* Method-specific inputs */}
          {method === 'search' && (
            <div className="space-y-4">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                  style={{ color: 'var(--text-tertiary)' }}
                />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {isSearching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border"
                      style={{
                        backgroundColor:
                          selectedUser?.id === user.id ? 'var(--surface-ground)' : 'transparent',
                        borderColor:
                          selectedUser?.id === user.id ? 'var(--accent)' : 'transparent'
                      }}
                      onClick={() => setSelectedUser(user)}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--surface-ground)' }}
                      >
                        {user.profileImage ? (
                          <img
                            src={user.profileImage}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-medium">{user.name.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {user.email}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>
                  No users found. Try inviting them via email instead.
                </p>
              )}
            </div>
          )}

          {method === 'invite' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="colleague@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
          )}

          {method === 'manual' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input
                placeholder="Team member name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
            </div>
          )}

          {/* Role (always shown) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Role / Title</label>
            <Input
              placeholder="e.g., Principal, Senior Designer, Project Manager"
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
            />
          </div>
        </div>

        <div
          className="flex justify-end gap-3 px-6 pb-6 pt-4"
          style={{ borderTop: '1px solid var(--ridge-outer)' }}
        >
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {method === 'invite' ? 'Send Invite' : 'Add to Team'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MethodOptionProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function MethodOption({ selected, onClick, icon, title, description }: MethodOptionProps) {
  return (
    <div
      className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer transition-colors"
      style={{
        borderColor: selected ? 'var(--accent)' : 'var(--ridge-outer)',
        backgroundColor: selected ? 'var(--surface-ground)' : 'transparent'
      }}
      onClick={onClick}
    >
      <div
        className="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5"
        style={{ borderColor: selected ? 'var(--accent)' : 'var(--ridge-outer)' }}
      >
        {selected && (
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: 'var(--accent)' }}
          />
        )}
      </div>
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </div>
      {icon}
    </div>
  );
}
