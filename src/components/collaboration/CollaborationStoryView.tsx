'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Block {
  type: string;
  text?: string;
  level?: number;
  speaker?: string;
  role?: string;
  url?: string;
  caption?: string;
}

interface CollaborationStoryViewProps {
  story: {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    heroImageUrl?: string | null;
    finalContent: Block[];
    publishedAt: string;
    vendorOrg: {
      id: string;
      name: string;
      logo?: string | null;
    };
    designer: {
      id: string;
      name: string;
      profileImage?: string | null;
    };
  };
}

export function CollaborationStoryView({ story }: CollaborationStoryViewProps) {
  const [showShareMenu, setShowShareMenu] = useState(false);

  const publishedDate = new Date(story.publishedAt);
  const formattedDate = publishedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleShare = async (platform: 'copy' | 'twitter' | 'linkedin') => {
    const url = window.location.href;
    const text = `${story.title} - A collaboration between ${story.vendorOrg.name} and ${story.designer.name}`;

    switch (platform) {
      case 'copy':
        await navigator.clipboard.writeText(url);
        // Could show a toast here
        break;
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
          '_blank'
        );
        break;
      case 'linkedin':
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
          '_blank'
        );
        break;
    }
    setShowShareMenu(false);
  };

  const blocks = story.finalContent || [];

  return (
    <article className="max-w-3xl mx-auto">
      {/* Hero */}
      {story.heroImageUrl && (
        <div className="mb-8 -mx-4 sm:mx-0">
          <img
            src={story.heroImageUrl}
            alt={story.title}
            className="w-full aspect-[16/9] object-cover sm:rounded-2xl"
          />
        </div>
      )}

      {/* Header */}
      <header className="mb-12">
        {/* Badge */}
        <div className="flex items-center gap-3 mb-4">
          <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium px-3 py-1 rounded-full">
            Collaboration
          </span>
          <span className="text-sm text-neutral-500">{formattedDate}</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-serif font-semibold text-neutral-900 mb-6 leading-tight">
          {story.title}
        </h1>

        {/* Excerpt */}
        <p className="text-xl text-neutral-600 leading-relaxed mb-8">{story.excerpt}</p>

        {/* Participants */}
        <div className="flex flex-wrap items-center gap-6 p-4 bg-neutral-50 rounded-xl">
          {/* Vendor */}
          <Link
            href={`/vendor/${story.vendorOrg.id}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {story.vendorOrg.logo ? (
              <img
                src={story.vendorOrg.logo}
                alt={story.vendorOrg.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                <span className="text-lg font-semibold text-[var(--accent)]">
                  {story.vendorOrg.name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wide">Vendor</p>
              <p className="font-medium text-neutral-900">{story.vendorOrg.name}</p>
            </div>
          </Link>

          {/* X connector */}
          <span className="text-2xl text-neutral-300 font-light">×</span>

          {/* Designer */}
          <Link
            href={`/designer/${story.designer.id}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {story.designer.profileImage ? (
              <img
                src={story.designer.profileImage}
                alt={story.designer.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-lg font-semibold text-purple-600">
                  {story.designer.name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wide">Designer</p>
              <p className="font-medium text-neutral-900">{story.designer.name}</p>
            </div>
          </Link>

          {/* Share button */}
          <div className="ml-auto relative">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </button>

            {showShareMenu && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-10">
                <button
                  onClick={() => handleShare('copy')}
                  className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  Copy link
                </button>
                <button
                  onClick={() => handleShare('twitter')}
                  className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  Share on X
                </button>
                <button
                  onClick={() => handleShare('linkedin')}
                  className="w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  Share on LinkedIn
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="prose prose-lg prose-neutral max-w-none">
        {blocks.map((block, index) => {
          switch (block.type) {
            case 'heading':
              if (block.level === 1) {
                return (
                  <h1 key={index} className="text-3xl font-serif font-semibold mt-12 mb-6">
                    {block.text}
                  </h1>
                );
              }
              if (block.level === 2) {
                return (
                  <h2 key={index} className="text-2xl font-serif font-semibold mt-10 mb-4">
                    {block.text}
                  </h2>
                );
              }
              return (
                <h3 key={index} className="text-xl font-semibold mt-8 mb-3">
                  {block.text}
                </h3>
              );
            case 'paragraph':
              return (
                <p key={index} className="my-5 text-neutral-700 leading-relaxed">
                  {block.text}
                </p>
              );
            case 'blockquote':
              return (
                <blockquote
                  key={index}
                  className="border-l-4 border-neutral-300 pl-5 my-6 italic text-neutral-600"
                >
                  {block.text}
                </blockquote>
              );
            case 'pullQuote':
              // Deliberately not rendered, including on stories already stored.
              //
              // These blocks were written by the model, not said by anyone. The
              // generator asked for "direct quotes from both parties" and set
              // whatever came back in display type under a named person's name and
              // role — and neither the vendor nor the designer sees this page before
              // it publishes, so nobody ever agreed to the words attributed to them.
              //
              // The generator no longer emits this block. Rows written before that
              // change still carry them, and they are left in place rather than
              // rewritten: skipping at render is reversible and touches no data, and
              // the real fix is quotes selected from the round responses the way
              // selectPullQuotes cuts them from interview answers. Until that exists,
              // the slot is empty.
              return null;
            case 'divider':
              return (
                <div key={index} className="my-12 flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                </div>
              );
            case 'image':
              return (
                <figure key={index} className="my-10">
                  <img
                    src={block.url}
                    alt={block.caption || ''}
                    className="w-full rounded-xl"
                  />
                  {block.caption && (
                    <figcaption className="text-sm text-neutral-500 mt-3 text-center">
                      {block.caption}
                    </figcaption>
                  )}
                </figure>
              );
            default:
              return null;
          }
        })}
      </div>

      {/* Footer */}
      <footer className="mt-16 pt-8 border-t border-neutral-200">
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            A collaboration between {story.vendorOrg.name} and {story.designer.name}
          </p>
          <Link
            href="/magazine"
            className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium"
          >
            More Collaborations →
          </Link>
        </div>
      </footer>
    </article>
  );
}
