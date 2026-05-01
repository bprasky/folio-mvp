'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { TopicCard } from './TopicCard';
import { ContributionModal } from './ContributionModal';
import type { ArticleTopicWithStats, ContributionType } from '@/lib/contributions/types';

interface GatheringVoicesSectionProps {
  className?: string;
}

export function GatheringVoicesSection({ className }: GatheringVoicesSectionProps) {
  const { data: session } = useSession();
  const [topics, setTopics] = useState<ArticleTopicWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<ArticleTopicWithStats | null>(null);

  // Fetch gathering topics
  useEffect(() => {
    async function fetchTopics() {
      try {
        const response = await fetch('/api/article-topics');
        if (response.ok) {
          const data = await response.json();
          // Only show topics user can contribute to (not already contributed)
          const availableTopics = data.topics.filter(
            (t: ArticleTopicWithStats) => !t.userContribution
          );
          setTopics(availableTopics.slice(0, 3)); // Max 3 topics
        }
      } catch (error) {
        console.error('Error fetching topics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTopics();
  }, [session?.user?.id]);

  const handleSubmit = async (content: string, type: ContributionType) => {
    if (!selectedTopic) return;

    const response = await fetch(`/api/contributions/${selectedTopic.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, type }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to submit contribution');
    }

    // Update local state to show contributed
    setTopics((prev) =>
      prev.filter((t) => t.id !== selectedTopic.id)
    );
  };

  // Don't show if not logged in or no topics
  if (!session?.user || loading || topics.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      {/* Header */}
      <div className="mb-6">
        <h2
          className="text-[13px] font-normal uppercase tracking-[0.12em] text-folio-text-secondary"
        >
          Now Gathering Voices
        </h2>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {topics.map((topic) => (
          <TopicCard
            key={topic.id}
            topic={topic}
            onContribute={() => setSelectedTopic(topic)}
          />
        ))}
      </div>

      {/* Contribution Modal */}
      {selectedTopic && (
        <ContributionModal
          topic={selectedTopic}
          userRole={session.user.role || 'INDIVIDUAL'}
          onSubmit={handleSubmit}
          onClose={() => setSelectedTopic(null)}
        />
      )}
    </section>
  );
}
