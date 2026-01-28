'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { RidgeCard } from '@/components/ui/ridge-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CATEGORIES = [
  { value: 'material', label: 'Material' },
  { value: 'trend', label: 'Trend' },
  { value: 'philosophy', label: 'Philosophy' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'regional', label: 'Regional' },
];

const ROLES = [
  { value: 'DESIGNER', label: 'Designer' },
  { value: 'VENDOR', label: 'Vendor/Rep' },
  { value: 'INDIVIDUAL', label: 'Individual' },
];

export default function NewArticleTopicPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [promptQuestion, setPromptQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('trend');
  const [tags, setTags] = useState('');
  const [targetRoles, setTargetRoles] = useState<string[]>(['DESIGNER', 'VENDOR', 'INDIVIDUAL']);
  const [minContributions, setMinContributions] = useState(5);
  const [targetContributions, setTargetContributions] = useState(15);
  const [minDesigners, setMinDesigners] = useState(3);
  const [minReps, setMinReps] = useState<number | null>(null);
  const [minIndividuals, setMinIndividuals] = useState<number | null>(null);
  const [targetPublishDate, setTargetPublishDate] = useState('');

  // Auth check
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  if (status === 'unauthenticated' || session?.user?.role !== 'ADMIN') {
    router.replace('/');
    return null;
  }

  const handleRoleToggle = (role: string) => {
    setTargetRoles((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/article-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          promptQuestion,
          description: description || undefined,
          category,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          targetRoles,
          minContributions,
          targetContributions,
          minDesigners,
          minReps: minReps || undefined,
          minIndividuals: minIndividuals || undefined,
          targetPublishDate: targetPublishDate || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create topic');
      }

      const data = await response.json();
      router.push(`/admin/article-topics/${data.topic.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="folio-h1 mb-2">Create Article Topic</h1>
          <p className="folio-body text-[var(--text-secondary)]">
            Define a topic to gather voices from your community
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <RidgeCard padding="lg" className="space-y-6">
            {/* Title */}
            <div>
              <label className="block folio-meta mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="The Quiet Return of Travertine"
                required
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                This will be the article headline
              </p>
            </div>

            {/* Prompt Question */}
            <div>
              <label className="block folio-meta mb-2">
                Prompt Question <span className="text-red-500">*</span>
              </label>
              <textarea
                value={promptQuestion}
                onChange={(e) => setPromptQuestion(e.target.value)}
                placeholder="What draws you to travertine right now?"
                className="ridge-input w-full px-3 py-2 min-h-[80px]"
                required
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                The question users will answer when contributing
              </p>
            </div>

            {/* Description (internal) */}
            <div>
              <label className="block folio-meta mb-2">
                Internal Notes
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes about editorial angle, timing, etc."
                className="ridge-input w-full px-3 py-2 min-h-[60px]"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block folio-meta mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="ridge-input px-4 py-2 w-full"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block folio-meta mb-2">
                Tags
              </label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="stone, natural, warm-tones"
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Comma-separated tags for categorization
              </p>
            </div>

            {/* Target Roles */}
            <div>
              <label className="block folio-meta mb-2">
                Target Roles
              </label>
              <div className="flex flex-wrap gap-3">
                {ROLES.map((role) => (
                  <label
                    key={role.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={targetRoles.includes(role.value)}
                      onChange={() => handleRoleToggle(role.value)}
                      className="rounded"
                    />
                    <span className="folio-body">{role.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Who can contribute to this topic (leave all checked for everyone)
              </p>
            </div>

            {/* Thresholds */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block folio-meta mb-2">
                  Min Contributions
                </label>
                <Input
                  type="number"
                  value={minContributions}
                  onChange={(e) => setMinContributions(parseInt(e.target.value) || 5)}
                  min={1}
                />
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Minimum to progress to writing
                </p>
              </div>
              <div>
                <label className="block folio-meta mb-2">
                  Target Contributions
                </label>
                <Input
                  type="number"
                  value={targetContributions}
                  onChange={(e) => setTargetContributions(parseInt(e.target.value) || 15)}
                  min={1}
                />
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Ideal number for the article
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block folio-meta mb-2">
                  Min Designers
                </label>
                <Input
                  type="number"
                  value={minDesigners}
                  onChange={(e) => setMinDesigners(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
              <div>
                <label className="block folio-meta mb-2">
                  Min Reps
                </label>
                <Input
                  type="number"
                  value={minReps || ''}
                  onChange={(e) => setMinReps(e.target.value ? parseInt(e.target.value) : null)}
                  min={0}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block folio-meta mb-2">
                  Min Individuals
                </label>
                <Input
                  type="number"
                  value={minIndividuals || ''}
                  onChange={(e) => setMinIndividuals(e.target.value ? parseInt(e.target.value) : null)}
                  min={0}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Target Publish Date */}
            <div>
              <label className="block folio-meta mb-2">
                Target Publish Date
              </label>
              <Input
                type="date"
                value={targetPublishDate}
                onChange={(e) => setTargetPublishDate(e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Creates urgency for contributors
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
              <Button
                type="button"
                variant="ridge"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="accent"
                disabled={loading || !title || !promptQuestion}
              >
                {loading ? 'Creating...' : 'Create Topic'}
              </Button>
            </div>
          </RidgeCard>
        </form>
      </div>
    </div>
  );
}
