'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ArticleTopic {
  id: string;
  title: string;
  slug: string;
  promptQuestion: string;
  category: string;
  tags: string[];
  targetRoles: string[];
  minContributions: number;
  targetContributions: number;
  status: string;
  queuedAt: string;
  gatheringStartedAt: string | null;
  targetPublishDate: string | null;
  contributionCount: number;
  designerCount: number;
  vendorCount: number;
  individualCount: number;
  trendSignalId: string | null;
}

interface AutoGeneratePreview {
  eligibleCount: number;
  signals: Array<{
    id: string;
    signalType: string;
    entityName: string;
    mentionCount: number;
  }>;
}

const statusColors: Record<string, string> = {
  QUEUED: 'bg-stone-100 text-stone-800',
  GATHERING: 'bg-blue-100 text-blue-800',
  THRESHOLD_MET: 'bg-green-100 text-green-800',
  WRITING: 'bg-amber-100 text-amber-800',
  REVIEW: 'bg-purple-100 text-purple-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  ARCHIVED: 'bg-stone-100 text-stone-500',
};

const categoryLabels: Record<string, string> = {
  material: 'Material',
  trend: 'Trend',
  philosophy: 'Philosophy',
  vendor: 'Vendor',
  regional: 'Regional',
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

function formatDaysAgo(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

export default function AdminArticleTopicsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [topics, setTopics] = useState<ArticleTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [activating, setActivating] = useState<string | null>(null);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoGeneratePreview, setAutoGeneratePreview] = useState<AutoGeneratePreview | null>(null);
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);

  // Check auth
  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') {
        router.replace('/');
      }
    } else if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [session, status, router]);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/admin/article-topics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTopics(data.topics);
      }
    } catch (error) {
      console.error('Error fetching topics:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchTopics();
    }
  }, [session, fetchTopics]);

  const handleActivate = async (topicId: string) => {
    setActivating(topicId);
    try {
      const response = await fetch(`/api/admin/article-topics/${topicId}/activate`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchTopics();
      }
    } catch (error) {
      console.error('Error activating topic:', error);
    } finally {
      setActivating(null);
    }
  };

  const handleCheckAutoGenerate = async () => {
    try {
      const response = await fetch('/api/admin/article-topics/auto-generate');
      if (response.ok) {
        const data = await response.json();
        setAutoGeneratePreview(data);
        setShowAutoGenerateModal(true);
      }
    } catch (error) {
      console.error('Error checking auto-generate:', error);
    }
  };

  const handleAutoGenerate = async () => {
    setAutoGenerating(true);
    try {
      const response = await fetch('/api/admin/article-topics/auto-generate', {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setShowAutoGenerateModal(false);
        setAutoGeneratePreview(null);
        fetchTopics();
        alert(`Generated ${data.generatedCount} new topic(s) from trends!`);
      }
    } catch (error) {
      console.error('Error auto-generating topics:', error);
    } finally {
      setAutoGenerating(false);
    }
  };

  // Group topics by status
  const groupedTopics = topics.reduce((acc, topic) => {
    if (!acc[topic.status]) acc[topic.status] = [];
    acc[topic.status].push(topic);
    return acc;
  }, {} as Record<string, ArticleTopic[]>);

  const statusOrder = ['GATHERING', 'THRESHOLD_MET', 'QUEUED', 'WRITING', 'REVIEW', 'PUBLISHED', 'ARCHIVED'];

  if (status === 'loading' || (status === 'authenticated' && session?.user?.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="folio-h1 mb-2">Article Topics</h1>
            <p className="folio-body">
              Manage the voice-gathering pipeline for upcoming articles
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="ridge" onClick={handleCheckAutoGenerate}>
              Check for Trend-Based Topics
            </Button>
            <Link href="/admin/article-topics/new">
              <Button variant="accent">Create Topic</Button>
            </Link>
          </div>
        </div>

        {/* Filter */}
        <RidgeCard padding="md" className="mb-6">
          <div className="flex gap-4 items-center">
            <span className="folio-meta">Filter by status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ridge-input px-4 py-2"
            >
              <option value="">All Statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="GATHERING">Gathering</option>
              <option value="THRESHOLD_MET">Threshold Met</option>
              <option value="WRITING">Writing</option>
              <option value="REVIEW">Review</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </RidgeCard>

        {/* Topics by Status */}
        {loading ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            Loading topics...
          </div>
        ) : topics.length === 0 ? (
          <RidgeCard padding="lg" className="text-center">
            <p className="folio-body text-[var(--text-secondary)] mb-4">
              No article topics found
            </p>
            <Link href="/admin/article-topics/new">
              <Button variant="accent">Create Your First Topic</Button>
            </Link>
          </RidgeCard>
        ) : (
          <div className="space-y-8">
            {statusOrder.map((statusKey) => {
              const statusTopics = groupedTopics[statusKey];
              if (!statusTopics || statusTopics.length === 0) return null;

              return (
                <div key={statusKey}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className={cn('px-3 py-1 rounded-full text-sm font-medium', statusColors[statusKey])}>
                      {statusKey.replace('_', ' ')}
                    </span>
                    <span className="folio-meta text-[var(--text-secondary)]">
                      {statusTopics.length} topic{statusTopics.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid gap-4">
                    {statusTopics.map((topic) => (
                      <RidgeCard key={topic.id} padding="md">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Link
                                href={`/admin/article-topics/${topic.id}`}
                                className="folio-h3 hover:text-[var(--accent)] transition-colors"
                              >
                                {topic.title}
                              </Link>
                              <span className="px-2 py-0.5 rounded text-xs bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                                {categoryLabels[topic.category] || topic.category}
                              </span>
                              {topic.trendSignalId && (
                                <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800">
                                  Auto-generated from trend
                                </span>
                              )}
                            </div>

                            <p className="folio-body text-[var(--text-secondary)] mb-3 line-clamp-1">
                              {topic.promptQuestion}
                            </p>

                            <div className="flex flex-wrap gap-4 folio-meta text-[var(--text-secondary)]">
                              {/* Progress bar */}
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[var(--accent)] transition-all"
                                    style={{
                                      width: `${Math.min(100, (topic.contributionCount / topic.targetContributions) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <span>
                                  {topic.contributionCount}/{topic.targetContributions}
                                </span>
                              </div>

                              {/* Role breakdown */}
                              <span>
                                {topic.designerCount}D / {topic.vendorCount}V / {topic.individualCount}I
                              </span>

                              {/* Started date */}
                              {topic.gatheringStartedAt && (
                                <span>
                                  Started {formatDaysAgo(topic.gatheringStartedAt)}
                                </span>
                              )}

                              {/* Target date */}
                              {topic.targetPublishDate && (
                                <span>
                                  Target: {formatDate(topic.targetPublishDate)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {topic.status === 'QUEUED' && (
                              <Button
                                variant="accent"
                                size="sm"
                                onClick={() => handleActivate(topic.id)}
                                disabled={activating === topic.id}
                              >
                                {activating === topic.id ? 'Activating...' : 'Activate'}
                              </Button>
                            )}
                            <Link href={`/admin/article-topics/${topic.id}`}>
                              <Button variant="ridge" size="sm">
                                View
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </RidgeCard>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Auto-Generate Modal */}
        {showAutoGenerateModal && autoGeneratePreview && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <RidgeCard padding="lg" className="max-w-lg w-full mx-4">
              <h2 className="folio-h2 mb-4">Generate Topics from Trends</h2>

              {autoGeneratePreview.eligibleCount === 0 ? (
                <div>
                  <p className="folio-body text-[var(--text-secondary)] mb-6">
                    No eligible trend signals found. Trends need at least 3 mentions
                    to be eligible for topic generation.
                  </p>
                  <div className="flex justify-end">
                    <Button
                      variant="ridge"
                      onClick={() => setShowAutoGenerateModal(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="folio-body text-[var(--text-secondary)] mb-4">
                    Found {autoGeneratePreview.eligibleCount} trend signal(s) eligible
                    for topic generation:
                  </p>

                  <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                    {autoGeneratePreview.signals.map((signal) => (
                      <div
                        key={signal.id}
                        className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] rounded-lg"
                      >
                        <div>
                          <span className="folio-body font-medium">
                            {signal.entityName}
                          </span>
                          <span className="folio-meta text-[var(--text-secondary)] ml-2">
                            ({signal.signalType})
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                          {signal.mentionCount} mentions
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="ridge"
                      onClick={() => setShowAutoGenerateModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="accent"
                      onClick={handleAutoGenerate}
                      disabled={autoGenerating}
                    >
                      {autoGenerating ? 'Generating...' : `Generate ${autoGeneratePreview.eligibleCount} Topic(s)`}
                    </Button>
                  </div>
                </div>
              )}
            </RidgeCard>
          </div>
        )}
      </div>
    </div>
  );
}
