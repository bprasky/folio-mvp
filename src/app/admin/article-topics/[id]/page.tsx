'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Contribution {
  id: string;
  userId: string;
  userRole: string;
  type: string;
  content: string;
  audioUrl: string | null;
  voiceTranscript: string | null;
  status: string;
  editedContent: string | null;
  pullQuote: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    profileImage: string | null;
    role: string;
    email: string;
  };
  product?: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
  project?: {
    id: string;
    title: string;
  } | null;
}

interface ArticleTopic {
  id: string;
  title: string;
  slug: string;
  promptQuestion: string;
  description: string | null;
  category: string;
  tags: string[];
  targetRoles: string[];
  minContributions: number;
  targetContributions: number;
  minDesigners: number;
  minReps: number | null;
  minIndividuals: number | null;
  status: string;
  queuedAt: string;
  gatheringStartedAt: string | null;
  targetPublishDate: string | null;
  contributionCount: number;
  designerCount: number;
  vendorCount: number;
  individualCount: number;
  contributionsByStatus: {
    PENDING: Contribution[];
    APPROVED: Contribution[];
    SELECTED: Contribution[];
    PUBLISHED: Contribution[];
    REJECTED: Contribution[];
  };
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-stone-100 text-stone-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  SELECTED: 'bg-green-100 text-green-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const topicStatusColors: Record<string, string> = {
  QUEUED: 'bg-stone-100 text-stone-800',
  GATHERING: 'bg-blue-100 text-blue-800',
  THRESHOLD_MET: 'bg-green-100 text-green-800',
  WRITING: 'bg-amber-100 text-amber-800',
  REVIEW: 'bg-purple-100 text-purple-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  ARCHIVED: 'bg-stone-100 text-stone-500',
};

const roleLabels: Record<string, string> = {
  DESIGNER: 'Designer',
  VENDOR: 'Vendor',
  INDIVIDUAL: 'Individual',
  ARCHITECT: 'Architect',
  BUILDER: 'Builder',
};

const typeLabels: Record<string, string> = {
  QUICK_TAKE: 'Quick Take',
  EXPERTISE: 'Expertise',
  PREDICTION: 'Prediction',
  REFLECTION: 'Reflection',
  ENDORSEMENT: 'Endorsement',
  CONSUMER_VOICE: 'Consumer Voice',
};

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ArticleTopicDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const topicId = params.id as string;

  const [topic, setTopic] = useState<ArticleTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('PENDING');

  // Pull quote modal
  const [editingContribution, setEditingContribution] = useState<Contribution | null>(null);
  const [pullQuote, setPullQuote] = useState('');

  // Auth check
  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') {
        router.replace('/');
      }
    } else if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [session, status, router]);

  const fetchTopic = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/article-topics/${topicId}`);
      if (response.ok) {
        const data = await response.json();
        setTopic(data.topic);
      }
    } catch (error) {
      console.error('Error fetching topic:', error);
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    if (session?.user?.role === 'ADMIN' && topicId) {
      fetchTopic();
    }
  }, [session, topicId, fetchTopic]);

  const handleUpdateStatus = async (contributionId: string, newStatus: string) => {
    setActionLoading(contributionId);
    try {
      const response = await fetch(`/api/admin/article-topics/${topicId}/contributions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contributionId,
          status: newStatus,
        }),
      });
      if (response.ok) {
        fetchTopic();
      }
    } catch (error) {
      console.error('Error updating contribution:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSavePullQuote = async () => {
    if (!editingContribution) return;
    setActionLoading(editingContribution.id);
    try {
      const response = await fetch(`/api/admin/article-topics/${topicId}/contributions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contributionId: editingContribution.id,
          status: editingContribution.status,
          pullQuote,
        }),
      });
      if (response.ok) {
        setEditingContribution(null);
        setPullQuote('');
        fetchTopic();
      }
    } catch (error) {
      console.error('Error saving pull quote:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async () => {
    setActionLoading('activate');
    try {
      const response = await fetch(`/api/admin/article-topics/${topicId}/activate`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchTopic();
      }
    } catch (error) {
      console.error('Error activating topic:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateTopicStatus = async (newStatus: string) => {
    setActionLoading('status');
    try {
      const response = await fetch(`/api/admin/article-topics/${topicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        fetchTopic();
      }
    } catch (error) {
      console.error('Error updating topic status:', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="text-folio-text-secondary">Loading...</div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="text-folio-text-secondary">Topic not found</div>
      </div>
    );
  }

  const contributions = topic.contributionsByStatus[activeTab as keyof typeof topic.contributionsByStatus] || [];

  return (
    <div className="min-h-screen bg-surface-canvas py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Back link */}
        <Link
          href="/admin/article-topics"
          className="inline-flex items-center gap-1 folio-meta text-folio-text-secondary hover:text-folio-text-primary mb-4"
        >
          &larr; Back to Topics
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="folio-h1">{topic.title}</h1>
              <span className={cn('px-3 py-1 rounded-full text-sm font-medium', topicStatusColors[topic.status])}>
                {topic.status.replace('_', ' ')}
              </span>
            </div>
            <p className="folio-body text-folio-text-secondary">
              {topic.promptQuestion}
            </p>
          </div>

          <div className="flex gap-2">
            {topic.status === 'QUEUED' && (
              <Button
                variant="accent"
                onClick={handleActivate}
                disabled={actionLoading === 'activate'}
              >
                {actionLoading === 'activate' ? 'Activating...' : 'Start Gathering'}
              </Button>
            )}
            {topic.status === 'GATHERING' && topic.contributionCount >= topic.minContributions && (
              <Button
                variant="accent"
                onClick={() => handleUpdateTopicStatus('WRITING')}
                disabled={actionLoading === 'status'}
              >
                Move to Writing
              </Button>
            )}
            {topic.status === 'THRESHOLD_MET' && (
              <Button
                variant="accent"
                onClick={() => handleUpdateTopicStatus('WRITING')}
                disabled={actionLoading === 'status'}
              >
                Move to Writing
              </Button>
            )}
            {topic.status === 'WRITING' && (
              <Button
                variant="accent"
                onClick={() => handleUpdateTopicStatus('REVIEW')}
                disabled={actionLoading === 'status'}
              >
                Submit for Review
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <RidgeCard padding="md" className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div>
              <div className="folio-meta text-folio-text-secondary mb-1">Progress</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 bg-surface-ground rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all"
                    style={{
                      width: `${Math.min(100, (topic.contributionCount / topic.targetContributions) * 100)}%`,
                    }}
                  />
                </div>
                <span className="folio-body font-medium">
                  {topic.contributionCount}/{topic.targetContributions}
                </span>
              </div>
            </div>
            <div>
              <div className="folio-meta text-folio-text-secondary mb-1">Designers</div>
              <div className="folio-h3">{topic.designerCount}</div>
            </div>
            <div>
              <div className="folio-meta text-folio-text-secondary mb-1">Vendors</div>
              <div className="folio-h3">{topic.vendorCount}</div>
            </div>
            <div>
              <div className="folio-meta text-folio-text-secondary mb-1">Individuals</div>
              <div className="folio-h3">{topic.individualCount}</div>
            </div>
            <div>
              <div className="folio-meta text-folio-text-secondary mb-1">Target Date</div>
              <div className="folio-body">{formatDate(topic.targetPublishDate)}</div>
            </div>
          </div>
        </RidgeCard>

        {/* Contribution Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {(['PENDING', 'APPROVED', 'SELECTED', 'PUBLISHED', 'REJECTED'] as const).map((tabStatus) => {
            const count = topic.contributionsByStatus[tabStatus]?.length || 0;
            return (
              <button
                key={tabStatus}
                onClick={() => setActiveTab(tabStatus)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                  activeTab === tabStatus
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-surface-ground text-folio-text-secondary hover:bg-surface-ground/80'
                )}
              >
                {tabStatus} ({count})
              </button>
            );
          })}
        </div>

        {/* Contributions List */}
        {contributions.length === 0 ? (
          <RidgeCard padding="lg" className="text-center">
            <p className="folio-body text-folio-text-secondary">
              No {activeTab.toLowerCase()} contributions
            </p>
          </RidgeCard>
        ) : (
          <div className="space-y-4">
            {contributions.map((contribution) => (
              <RidgeCard key={contribution.id} padding="md">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-surface-ground overflow-hidden flex-shrink-0">
                    {contribution.user.profileImage ? (
                      <Image
                        src={contribution.user.profileImage}
                        alt={contribution.user.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-folio-text-secondary text-lg font-medium">
                        {contribution.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium">{contribution.user.name}</span>
                      <span className="px-2 py-0.5 rounded text-xs bg-surface-ground text-folio-text-secondary">
                        {roleLabels[contribution.userRole] || contribution.userRole}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-surface-ground text-folio-text-secondary">
                        {typeLabels[contribution.type] || contribution.type}
                      </span>
                      <span className="folio-meta text-folio-text-secondary">
                        {formatDate(contribution.createdAt)}
                      </span>
                    </div>

                    <p className="folio-body mb-3 whitespace-pre-wrap">
                      {contribution.content}
                    </p>

                    {contribution.pullQuote && (
                      <div className="p-3 bg-surface-ground rounded-lg mb-3 border-l-4 border-[var(--accent)]">
                        <div className="folio-meta text-folio-text-secondary mb-1">Pull Quote</div>
                        <p className="folio-body italic">&ldquo;{contribution.pullQuote}&rdquo;</p>
                      </div>
                    )}

                    {contribution.audioUrl && (
                      <div className="mb-3">
                        <audio controls src={contribution.audioUrl} className="w-full max-w-md" />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {activeTab === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            variant="ridge"
                            onClick={() => handleUpdateStatus(contribution.id, 'APPROVED')}
                            disabled={actionLoading === contribution.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ridge"
                            onClick={() => handleUpdateStatus(contribution.id, 'REJECTED')}
                            disabled={actionLoading === contribution.id}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {activeTab === 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="accent"
                          onClick={() => handleUpdateStatus(contribution.id, 'SELECTED')}
                          disabled={actionLoading === contribution.id}
                        >
                          Select for Article
                        </Button>
                      )}
                      {(activeTab === 'SELECTED' || activeTab === 'APPROVED') && (
                        <Button
                          size="sm"
                          variant="ridge"
                          onClick={() => {
                            setEditingContribution(contribution);
                            setPullQuote(contribution.pullQuote || '');
                          }}
                        >
                          {contribution.pullQuote ? 'Edit Pull Quote' : 'Add Pull Quote'}
                        </Button>
                      )}
                      {activeTab === 'SELECTED' && (
                        <Button
                          size="sm"
                          variant="accent"
                          onClick={() => handleUpdateStatus(contribution.id, 'PUBLISHED')}
                          disabled={actionLoading === contribution.id}
                        >
                          Mark Published
                        </Button>
                      )}
                      {activeTab === 'REJECTED' && (
                        <Button
                          size="sm"
                          variant="ridge"
                          onClick={() => handleUpdateStatus(contribution.id, 'PENDING')}
                          disabled={actionLoading === contribution.id}
                        >
                          Move to Pending
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </RidgeCard>
            ))}
          </div>
        )}

        {/* Pull Quote Modal */}
        {editingContribution && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <RidgeCard padding="lg" className="max-w-lg w-full">
              <h2 className="folio-h2 mb-4">Edit Pull Quote</h2>
              <p className="folio-body text-folio-text-secondary mb-4">
                Extract a quotable snippet from this contribution
              </p>
              <div className="mb-4 p-3 bg-surface-ground rounded-lg">
                <p className="folio-body text-sm">{editingContribution.content}</p>
              </div>
              <textarea
                value={pullQuote}
                onChange={(e) => setPullQuote(e.target.value)}
                placeholder="Enter the pull quote..."
                className="ridge-input w-full px-3 py-2 min-h-[100px] mb-4"
              />
              <div className="flex justify-end gap-3">
                <Button
                  variant="ridge"
                  onClick={() => {
                    setEditingContribution(null);
                    setPullQuote('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  onClick={handleSavePullQuote}
                  disabled={actionLoading === editingContribution.id}
                >
                  {actionLoading === editingContribution.id ? 'Saving...' : 'Save Pull Quote'}
                </Button>
              </div>
            </RidgeCard>
          </div>
        )}
      </div>
    </div>
  );
}
