'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GlassInput } from '@/components/ui/glass-input';
import { GlassTextarea } from '@/components/ui/glass-textarea';

type Stage = 'write' | 'review';

interface ProposedFields {
  location: string | null;
  title: string | null;
  specialties: string[];
  bio: string | null;
}

interface BioFormProps {
  initialBio: string;
}

const PROMPT_HINT =
  "Where you work, what you focus on, how long you've been doing this. A few sentences is enough. We'll handle the rest.";

export function BioForm({ initialBio }: BioFormProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('write');
  const [bio, setBio] = useState(initialBio);
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [title, setTitle] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [reviewBio, setReviewBio] = useState('');

  async function handleExtract() {
    if (bio.trim().length < 10) {
      setError('Tell us a little more — a few sentences is enough.');
      return;
    }
    setError(null);
    setExtracting(true);
    try {
      const res = await fetch('/api/onboarding/bio/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Extraction failed');
      }
      const data = await res.json();
      const proposed: ProposedFields = data.proposed;
      setLocation(proposed.location ?? '');
      setTitle(proposed.title ?? '');
      setSpecialties(proposed.specialties ?? []);
      setReviewBio(proposed.bio ?? bio);
      setStage('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setExtracting(false);
    }
  }

  async function handleCommit() {
    if (!reviewBio.trim()) {
      setError('Bio cannot be empty.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/bio/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: reviewBio,
          location: location.trim() || null,
          title: title.trim() || null,
          specialties,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not save bio');
      }
      router.replace('/onboarding/profile-preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  function addSpecialty() {
    const tag = specialtyInput.trim().toLowerCase();
    if (!tag) return;
    if (specialties.includes(tag)) {
      setSpecialtyInput('');
      return;
    }
    if (specialties.length >= 12) return;
    setSpecialties([...specialties, tag]);
    setSpecialtyInput('');
  }

  function removeSpecialty(tag: string) {
    setSpecialties(specialties.filter((s) => s !== tag));
  }

  if (stage === 'write') {
    return (
      <div className="space-y-6">
        <p className="text-center text-folio-text-secondary font-body">
          {PROMPT_HINT}
        </p>

        <GlassTextarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={6}
          className="min-h-[200px]"
          placeholder="I'm a residential designer based in Brooklyn. My studio focuses on adaptive reuse and prewar restoration. Twelve years in practice…"
          autoFocus
        />

        {error && (
          <p className="text-sm text-red-600 text-center" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 items-center pt-2">
          <Button
            variant="accent"
            size="lg"
            onClick={handleExtract}
            disabled={extracting || bio.trim().length < 10}
            className="min-w-[200px]"
          >
            {extracting ? 'Reading…' : 'Continue →'}
          </Button>
          <button
            type="button"
            onClick={() => router.replace('/onboarding/profile-preview')}
            className="text-xs text-folio-text-tertiary hover:text-folio-text-secondary underline-offset-4 hover:underline"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-center text-folio-text-secondary font-body">
        We pulled these out. Edit anything that's off — or leave a field blank.
      </p>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm text-folio-text-secondary font-body">Title</span>
          <GlassInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Principal Designer"
            className="mt-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-folio-text-secondary font-body">
            Location
          </span>
          <GlassInput
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Brooklyn, NY"
            className="mt-2"
          />
        </label>
        <div>
          <span className="text-sm text-folio-text-secondary font-body">
            Specialties
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {specialties.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeSpecialty(tag)}
                className="text-xs px-3 py-1 rounded-full bg-surface-ground/80 border border-folio-border-subtle/70 text-folio-text-primary hover:border-folio-border-subtle"
                aria-label={`Remove ${tag}`}
              >
                {tag} ×
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <GlassInput
              value={specialtyInput}
              onChange={(e) => setSpecialtyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSpecialty();
                }
              }}
              placeholder="Add a specialty (e.g., residential)"
            />
            <Button type="button" variant="ridge" onClick={addSpecialty}>
              Add
            </Button>
          </div>
        </div>
        <label className="block">
          <span className="text-sm text-folio-text-secondary font-body">Bio</span>
          <GlassTextarea
            value={reviewBio}
            onChange={(e) => setReviewBio(e.target.value)}
            rows={6}
            className="mt-2 min-h-[180px]"
          />
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 items-center pt-2">
        <Button
          variant="accent"
          size="lg"
          onClick={handleCommit}
          disabled={submitting || !reviewBio.trim()}
          className="min-w-[200px]"
        >
          {submitting ? 'Saving…' : 'Save profile →'}
        </Button>
        <button
          type="button"
          onClick={() => setStage('write')}
          disabled={submitting}
          className="text-sm text-folio-text-tertiary hover:text-folio-text-secondary underline-offset-4 hover:underline"
        >
          Rewrite my bio
        </button>
      </div>
    </div>
  );
}
