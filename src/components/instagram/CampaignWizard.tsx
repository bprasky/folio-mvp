'use client';

import { useState, useEffect } from 'react';
import { FaInstagram, FaTimes, FaDownload, FaSpinner } from 'react-icons/fa';

interface CampaignWizardProps {
  projectId: string;
  projectTitle: string;
  onClose: () => void;
}

type CampaignPreset = 'compact' | 'standard' | 'complete';

interface ContentSelection {
  preset: CampaignPreset;
  totalPosts: number;
  projectTitle: string;
  designerName: string;
  imagesById: Record<string, { url: string }>;
  launch: { enabled: true; heroImageId: string };
  rooms: Array<{
    name: string;
    imageIds: string[];
    imageCount: number;
    suggested: boolean;
  }>;
  products: Array<{
    id: string;
    name: string;
    brand: string;
    imageId: string;
    suggested: boolean;
  }>;
  quotes: Array<{
    text: string;
    authorship: 'verbatim' | 'folio';
    imageId?: string;
    suggested: boolean;
  }>;
  details: Array<{
    imageId: string;
    caption: string;
  }>;
  closer: { enabled: true; imageId: string };
}

type PostMockup =
  | { type: 'launch'; imageUrl: string; title: string; subtitle: string }
  | { type: 'room_spotlight'; imageUrl: string; title: string; subtitle: string; slideCount: number }
  | { type: 'product_feature'; imageUrl: string; title: string; subtitle: string }
  | { type: 'quote'; text: string; attribution: string; authorship: 'verbatim' | 'folio' }
  | { type: 'detail'; imageUrl: string; title: string }
  | { type: 'closer'; imageUrl: string; title: string; subtitle: string };

function buildPostMockups(c: ContentSelection): PostMockup[] {
  const posts: PostMockup[] = [];
  const urlFor = (id: string | undefined) =>
    (id && c.imagesById[id]?.url) || '';

  posts.push({
    type: 'launch',
    imageUrl: urlFor(c.launch.heroImageId),
    title: c.projectTitle,
    subtitle: c.designerName,
  });

  for (const room of c.rooms.filter((r) => r.suggested)) {
    posts.push({
      type: 'room_spotlight',
      imageUrl: urlFor(room.imageIds[0]),
      title: room.name,
      subtitle: c.projectTitle,
      slideCount: room.imageCount,
    });
  }

  for (const product of c.products.filter((p) => p.suggested)) {
    posts.push({
      type: 'product_feature',
      imageUrl: urlFor(product.imageId),
      title: product.name,
      subtitle: product.brand,
    });
  }

  for (const quote of c.quotes.filter((q) => q.suggested)) {
    posts.push({
      type: 'quote',
      text: quote.text,
      authorship: quote.authorship,
      attribution: quote.authorship === 'folio' ? 'Written by Folio' : c.designerName,
    });
  }

  for (const detail of c.details) {
    posts.push({
      type: 'detail',
      imageUrl: urlFor(detail.imageId),
      title: 'The details',
    });
  }

  posts.push({
    type: 'closer',
    imageUrl: urlFor(c.closer.imageId),
    title: c.projectTitle,
    subtitle: 'Explore on Folio',
  });

  return posts;
}

export function CampaignWizard({ projectId, projectTitle, onClose }: CampaignWizardProps) {
  const [preset, setPreset] = useState<CampaignPreset>('standard');
  const [contentSelection, setContentSelection] = useState<ContentSelection | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load content selection when preset changes
  useEffect(() => {
    async function loadContent() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/instagram/campaign/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, preset }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to load campaign preview');
        }

        const data = await response.json();
        setContentSelection(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadContent();
  }, [projectId, preset]);

  const handleGenerate = async () => {
    if (!contentSelection) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/instagram/campaign/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          preset,
          formats: ['square', 'portrait', 'story'],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate campaign');
      }

      // Download ZIP file
      const base64Data = await response.text();
      const blob = new Blob(
        [Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))],
        { type: 'application/zip' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-instagram-campaign.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Close modal after successful download
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const selectedRooms = contentSelection?.rooms.filter((r) => r.suggested).length || 0;
  const selectedProducts = contentSelection?.products.filter((p) => p.suggested).length || 0;
  const selectedQuotes = contentSelection?.quotes.filter((q) => q.suggested).length || 0;
  const totalPosts = contentSelection?.totalPosts || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-folio-border-subtle p-6">
          <div>
            <h2 className="text-2xl font-semibold text-folio-text-primary">
              Generate Instagram Campaign
            </h2>
            <p className="mt-1 text-sm text-folio-text-secondary">{projectTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-folio-text-tertiary hover:bg-surface-ground hover:text-folio-text-secondary"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Preset Selection */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-folio-text-primary">Campaign Size</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPreset('compact')}
                className={`rounded-lg border-2 p-4 text-center transition ${
                  preset === 'compact'
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-folio-border-subtle hover:border-folio-border-subtle'
                }`}
              >
                <div className="text-lg font-semibold text-folio-text-primary">Compact</div>
                <div className="mt-1 text-sm text-folio-text-secondary">4-6 posts</div>
              </button>
              <button
                onClick={() => setPreset('standard')}
                className={`rounded-lg border-2 p-4 text-center transition ${
                  preset === 'standard'
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-folio-border-subtle hover:border-folio-border-subtle'
                }`}
              >
                <div className="text-lg font-semibold text-folio-text-primary">Standard</div>
                <div className="mt-1 text-sm text-folio-text-secondary">8-12 posts</div>
              </button>
              <button
                onClick={() => setPreset('complete')}
                className={`rounded-lg border-2 p-4 text-center transition ${
                  preset === 'complete'
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-folio-border-subtle hover:border-folio-border-subtle'
                }`}
              >
                <div className="text-lg font-semibold text-folio-text-primary">Complete</div>
                <div className="mt-1 text-sm text-folio-text-secondary">15-20+ posts</div>
              </button>
            </div>
          </div>

          {/* Content Preview */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <FaSpinner className="animate-spin text-folio-text-tertiary" size={32} />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {contentSelection && !loading && (
            <div className="space-y-4">
              <div className="rounded-lg border border-folio-border-subtle bg-surface-ground p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-medium text-folio-text-primary">Preview</h3>
                  <span className="text-2xl font-semibold text-[var(--accent)]">{totalPosts} posts</span>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2">
                  {buildPostMockups(contentSelection).map((post, idx, arr) => (
                    <PostMockupCard
                      key={idx}
                      post={post}
                      sequenceNum={idx + 1}
                      total={arr.length}
                    />
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-folio-text-secondary">
                  <span>1 launch</span>
                  {selectedRooms > 0 && <span>· {selectedRooms} room{selectedRooms === 1 ? '' : 's'}</span>}
                  {selectedProducts > 0 && <span>· {selectedProducts} product{selectedProducts === 1 ? '' : 's'}</span>}
                  {selectedQuotes > 0 && <span>· {selectedQuotes} quote{selectedQuotes === 1 ? '' : 's'}</span>}
                  {contentSelection.details.length > 0 && (
                    <span>· {contentSelection.details.length} detail{contentSelection.details.length === 1 ? '' : 's'}</span>
                  )}
                  <span>· 1 closer</span>
                </div>
              </div>

              {/* Formats */}
              <div className="rounded-lg border border-folio-border-subtle bg-white p-4">
                <h3 className="mb-2 text-sm font-medium text-folio-text-primary">Formats</h3>
                <div className="space-y-1 text-sm text-folio-text-secondary">
                  <div>✓ Feed (1080×1080, 1080×1350)</div>
                  <div>✓ Stories (1080×1920)</div>
                </div>
              </div>

              {/* Suggested Pacing */}
              <div className="rounded-lg bg-[var(--accent)]/5 p-4 text-sm">
                <div className="font-medium text-blue-900">
                  Suggested pacing: 2 posts/week ≈ {Math.ceil(totalPosts / 2)} weeks
                </div>
                <div className="mt-1 text-[var(--accent-hover)]">
                  Mix with other projects for feed variety.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-folio-border-subtle bg-surface-ground p-6">
          <button
            onClick={onClose}
            className="rounded-lg border border-folio-border-subtle px-6 py-2.5 text-sm font-medium text-folio-text-primary hover:bg-surface-ground"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!contentSelection || generating}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? (
              <>
                <FaSpinner className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FaDownload />
                Generate & Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostMockupCard({
  post,
  sequenceNum,
  total,
}: {
  post: PostMockup;
  sequenceNum: number;
  total: number;
}) {
  const sequenceBadge = (
    <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[var(--type-fine)] font-medium text-white backdrop-blur-sm">
      {sequenceNum}/{total}
    </span>
  );

  const folioMark = (
    <span className="absolute bottom-2 right-2 text-[9px] font-medium uppercase tracking-[var(--ls-eyebrow)] text-white/90"> /* folio-design-system: off-scale */
      Folio
    </span>
  );

  if (post.type === 'quote') {
    return (
      <div className="relative flex h-[175px] w-[140px] flex-shrink-0 flex-col justify-center rounded-md bg-folio-ink p-3 text-white">
        {sequenceBadge}
        <p className="line-clamp-5 font-serif text-[var(--type-eyebrow)] italic leading-snug text-white">
          {post.authorship === 'folio' ? post.text : <> &ldquo;{post.text}&rdquo; </>}
        </p>
        <p className="mt-2 text-[9px] uppercase tracking-[var(--ls-eyebrow)] text-white/70"> /* folio-design-system: off-scale */
          {post.attribution}
        </p>
        {folioMark}
      </div>
    );
  }

  const typeLabel: Record<Exclude<PostMockup['type'], 'quote'>, string> = {
    launch: 'Launch',
    room_spotlight: 'Room',
    product_feature: 'Product',
    detail: 'Detail',
    closer: 'Closer',
  };

  return (
    <div
      className="relative h-[175px] w-[140px] flex-shrink-0 overflow-hidden rounded-md bg-folio-stone-100"
      style={
        post.imageUrl
          ? {
              backgroundImage: `url(${post.imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
      {sequenceBadge}
      {post.type === 'room_spotlight' && post.slideCount > 1 && (
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[var(--type-fine)] font-medium text-white backdrop-blur-sm">
          {post.slideCount} slides
        </span>
      )}
      <div className="absolute inset-x-2 bottom-5 text-white">
        <p className={"text-[9px] uppercase tracking-[var(--ls-eyebrow)] text-white/80" /* folio-design-system: off-scale */}>
          {typeLabel[post.type]}
        </p>
        <p className="line-clamp-2 font-serif text-sm leading-tight">{post.title}</p>
        {'subtitle' in post && post.subtitle && (
          <p className="mt-0.5 line-clamp-1 text-[var(--type-fine)] text-white/80">{post.subtitle}</p>
        )}
      </div>
      {folioMark}
    </div>
  );
}
