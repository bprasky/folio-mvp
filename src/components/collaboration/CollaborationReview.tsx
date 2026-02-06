'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Block {
  type: string;
  text?: string;
  level?: number;
  speaker?: string;
  role?: string;
  url?: string;
  caption?: string;
}

interface CollaborationReviewProps {
  storyId: string;
  title: string;
  excerpt: string;
  blocks: Block[];
  role: 'vendor' | 'designer';
  vendorApproved: boolean;
  designerApproved: boolean;
  revisionFeedback?: {
    from: string;
    feedback: string;
    requestedAt: string;
  } | null;
  onApprove?: () => void;
  onPublish?: () => void;
}

export function CollaborationReview({
  storyId,
  title,
  excerpt,
  blocks,
  role,
  vendorApproved,
  designerApproved,
  revisionFeedback,
  onApprove,
  onPublish,
}: CollaborationReviewProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState('');

  const hasApproved = role === 'vendor' ? vendorApproved : designerApproved;
  const otherApproved = role === 'vendor' ? designerApproved : vendorApproved;
  const bothApproved = vendorApproved && designerApproved;

  const handleApprove = async (approved: boolean) => {
    if (!approved && !showFeedbackForm) {
      setShowFeedbackForm(true);
      return;
    }

    setIsApproving(true);
    try {
      const res = await fetch(`/api/collaboration/stories/${storyId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved,
          feedback: !approved ? feedback : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit');
      }

      const data = await res.json();
      toast.success(data.message);
      onApprove?.();

      if (data.bothApproved) {
        // Could auto-publish or let user decide
      }
    } catch (error: any) {
      console.error('Failed to approve:', error);
      toast.error(error.message || 'Failed to submit');
    } finally {
      setIsApproving(false);
      setShowFeedbackForm(false);
      setFeedback('');
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/collaboration/stories/${storyId}/publish`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to publish');
      }

      const data = await res.json();
      toast.success('Story published!');
      onPublish?.();

      // Could redirect to the published URL
      // window.location.href = data.url;
    } catch (error: any) {
      console.error('Failed to publish:', error);
      toast.error(error.message || 'Failed to publish');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Revision Feedback Alert */}
      {revisionFeedback && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-amber-500 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h4 className="font-medium text-amber-800">Revision Requested</h4>
              <p className="text-sm text-amber-700 mt-1">
                {revisionFeedback.from === 'vendor' ? 'The vendor' : 'The designer'} requested
                changes:
              </p>
              <p className="text-sm text-amber-900 mt-2 italic">
                "{revisionFeedback.feedback}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Approval Status */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            vendorApproved
              ? 'bg-green-100 text-green-700'
              : 'bg-neutral-100 text-neutral-500'
          }`}
        >
          {vendorApproved ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-current" />
          )}
          <span>Vendor {vendorApproved ? 'Approved' : 'Pending'}</span>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            designerApproved
              ? 'bg-green-100 text-green-700'
              : 'bg-neutral-100 text-neutral-500'
          }`}
        >
          {designerApproved ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-current" />
          )}
          <span>Designer {designerApproved ? 'Approved' : 'Pending'}</span>
        </div>
      </div>

      {/* Story Preview */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden mb-6">
        <div className="p-8">
          {/* Title and excerpt */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium px-2 py-1 rounded">
                Collaboration
              </span>
            </div>
            <h1 className="text-3xl font-serif font-semibold text-neutral-900 mb-4">{title}</h1>
            <p className="text-lg text-neutral-600">{excerpt}</p>
          </div>

          {/* Content blocks */}
          <div className="prose prose-neutral max-w-none">
            {blocks.map((block, index) => {
              switch (block.type) {
                case 'heading':
                  if (block.level === 1) {
                    return (
                      <h1 key={index} className="text-2xl font-semibold mt-8 mb-4">
                        {block.text}
                      </h1>
                    );
                  }
                  if (block.level === 2) {
                    return (
                      <h2 key={index} className="text-xl font-semibold mt-6 mb-3">
                        {block.text}
                      </h2>
                    );
                  }
                  return (
                    <h3 key={index} className="text-lg font-semibold mt-4 mb-2">
                      {block.text}
                    </h3>
                  );
                case 'paragraph':
                  return (
                    <p key={index} className="my-4 text-neutral-700 leading-relaxed">
                      {block.text}
                    </p>
                  );
                case 'blockquote':
                  return (
                    <blockquote
                      key={index}
                      className="border-l-4 border-neutral-200 pl-4 my-4 italic text-neutral-600"
                    >
                      {block.text}
                    </blockquote>
                  );
                case 'pullQuote':
                  return (
                    <div
                      key={index}
                      className="my-8 p-6 bg-neutral-50 rounded-xl border-l-4 border-[var(--accent)]"
                    >
                      <p className="text-lg italic text-neutral-800 mb-3">"{block.text}"</p>
                      <p className="text-sm font-medium text-neutral-600">
                        — {block.speaker}
                        {block.role && <span className="text-neutral-400">, {block.role}</span>}
                      </p>
                    </div>
                  );
                case 'divider':
                  return <hr key={index} className="my-8 border-neutral-200" />;
                case 'image':
                  return (
                    <figure key={index} className="my-6">
                      <img
                        src={block.url}
                        alt={block.caption || ''}
                        className="w-full rounded-lg"
                      />
                      {block.caption && (
                        <figcaption className="text-sm text-neutral-500 mt-2 text-center">
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
        </div>
      </div>

      {/* Feedback Form */}
      {showFeedbackForm && (
        <div className="mb-6 p-4 bg-neutral-50 rounded-xl">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            What changes would you like to see?
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Describe the changes you'd like..."
            className="w-full h-24 px-3 py-2 border border-neutral-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            maxLength={1000}
          />
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowFeedbackForm(false);
                setFeedback('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleApprove(false)}
              disabled={isApproving || !feedback.trim()}
            >
              {isApproving ? 'Sending...' : 'Request Changes'}
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!showFeedbackForm && (
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => handleApprove(false)} disabled={isApproving}>
            Request Changes
          </Button>

          <div className="flex gap-2">
            {!hasApproved && (
              <Button onClick={() => handleApprove(true)} disabled={isApproving}>
                {isApproving ? 'Approving...' : 'Approve'}
              </Button>
            )}
            {bothApproved && (
              <Button
                onClick={handlePublish}
                disabled={isPublishing}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                {isPublishing ? 'Publishing...' : 'Publish Story'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
