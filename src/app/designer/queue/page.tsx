'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Sparkles, ArrowRight } from 'lucide-react';

// ─── Types (mirror GET /api/editorial-queue) ─────────────────────────────────

interface PromptItem {
  id: string;
  prompt: string;
  hint?: string;
  optionA?: string;
  optionB?: string;
}
interface PromptStructure {
  format: string;
  intro: string;
  items: PromptItem[];
}
interface QueueItem {
  id: string;
  format: string;
  status: string;
  prompts: PromptStructure | null;
  createdAt: string;
  angle: { angleType: string; summary: string; confidence: number };
}

// ─── Display helpers ─────────────────────────────────────────────────────────

const FORMAT_LABEL: Record<string, string> = {
  QA: 'Q&A',
  THIS_OR_THAT: 'This or That',
  GET_TO_KNOW: 'Get to Know',
  MATERIAL_STUDY: 'Material Study',
  METHOD: 'Method',
  DESIGNER_PROFILE: 'Profile',
};

function titleCase(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function EditorialQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/editorial-queue');
      if (!res.ok) throw new Error(`Failed to load queue (${res.status})`);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/editorial-queue/generate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Generation failed.');

      switch (data.status) {
        case 'unlocked':
          toast.success(`Folio drafted ${data.createdPieces} ${data.createdPieces === 1 ? 'story' : 'stories'} from your work.`);
          await load();
          break;
        case 'already_unlocked':
          toast.info('Your queue is already open — showing your latest pieces.');
          await load();
          break;
        case 'below_gate':
          toast.info(`Publish ${3 - data.publishedStories} more ${3 - data.publishedStories === 1 ? 'story' : 'stories'} to open your editorial desk.`);
          break;
        case 'no_pieces_generated':
          toast.error('Folio could not draft pieces right now. Please try again shortly.');
          break;
        default:
          await load();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }, [load]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 text-folio-text-secondary mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="folio-meta uppercase tracking-wide">Editorial Queue</span>
          </div>
          <h1 className="folio-h1 text-folio-text-primary">Your editorial desk</h1>
          <p className="folio-ui text-folio-text-secondary mt-2 max-w-xl">
            Folio reads your published work and drafts the next stories worth telling. Review a
            piece, answer a few questions only you can answer, and it publishes to your feed.
          </p>
        </div>
        <Button onClick={generate} disabled={generating} className="shrink-0">
          {generating ? 'Drafting…' : 'Refresh queue'}
        </Button>
      </div>

      {/* States */}
      {loading ? (
        <p className="folio-ui text-folio-text-secondary mt-10">Loading your queue…</p>
      ) : error ? (
        <div className="mt-10">
          <p className="folio-ui text-folio-text-primary">{error}</p>
          <Button variant="outline" onClick={load} className="mt-3">Try again</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 border border-folio-border-subtle rounded-2xl p-8 text-center">
          <Sparkles className="h-6 w-6 mx-auto text-folio-text-secondary" />
          <h2 className="folio-h3 text-folio-text-primary mt-3">No pieces yet</h2>
          <p className="folio-ui text-folio-text-secondary mt-2 max-w-md mx-auto">
            Once you have three published stories, Folio drafts recommended pieces from your body of
            work. Generate them now if you are ready.
          </p>
          <Button onClick={generate} disabled={generating} className="mt-5">
            {generating ? 'Drafting…' : 'Generate my queue'}
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {items.map((item) => (
            <QueueCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  const [expanded, setExpanded] = useState(false);
  const formatLabel = FORMAT_LABEL[item.format] ?? titleCase(item.format);
  const prompts = item.prompts?.items ?? [];

  return (
    <div className="border border-folio-border-subtle rounded-2xl p-6 bg-surface-canvas">
      {/* Meta row */}
      <div className="flex items-center gap-2 mb-3">
        <span className="folio-meta uppercase tracking-wide px-2 py-0.5 rounded-full bg-surface-ground text-folio-text-secondary">
          {formatLabel}
        </span>
        <span className="folio-meta text-folio-text-secondary">{titleCase(item.angle.angleType)}</span>
      </div>

      {/* The editorial framing — the hook */}
      <h3 className="folio-h3 text-folio-text-primary">{item.angle.summary}</h3>
      {item.prompts?.intro && (
        <p className="folio-ui text-folio-text-secondary mt-2">{item.prompts.intro}</p>
      )}

      {/* Prompts */}
      {prompts.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="folio-meta text-folio-text-secondary hover:text-folio-text-primary transition-colors"
          >
            {expanded ? 'Hide' : `Preview the ${prompts.length} question${prompts.length === 1 ? '' : 's'}`}
          </button>

          {expanded && (
            <ol className="mt-3 space-y-3 list-none">
              {prompts.map((p, i) => (
                <li key={p.id} className="border-l-2 border-folio-border-subtle pl-4">
                  <p className="folio-ui text-folio-text-primary">
                    <span className="text-folio-text-secondary mr-2">{i + 1}.</span>
                    {p.prompt}
                  </p>
                  {(p.optionA || p.optionB) && (
                    <p className="folio-meta text-folio-text-secondary mt-1">
                      {p.optionA} <span className="opacity-60">or</span> {p.optionB}
                    </p>
                  )}
                  {p.hint && (
                    <p className="folio-meta text-folio-text-secondary mt-1 italic">{p.hint}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Action — completion flow lands in a later step */}
      <div className="mt-5 flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => toast.info('The answer-and-publish flow is coming next.')}
          className="gap-1"
        >
          Answer &amp; launch <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
