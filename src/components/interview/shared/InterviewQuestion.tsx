"use client";

import Image from "next/image";

interface InterviewQuestionProps {
  question: string;
  context?: string;
  relatedImage?: {
    url: string;
    alt: string;
  };
}

/**
 * InterviewQuestion
 *
 * The styled question text component used in both voice and text modes.
 * THIS IS THE COMPONENT THE USER LIKES - preserve the styling.
 *
 * Styling:
 * - Question text: text-2xl md:text-3xl font-serif italic text-folio-text-primary
 * - Leading: leading-relaxed (1.625)
 * - Context (if present): text-lg text-folio-text-secondary mb-2, not italic
 * - Container: max-w-2xl mx-auto text-center md:text-left
 * - Image thumbnail: w-16 h-16 rounded-lg object-cover mb-4
 */
export function InterviewQuestion({
  question,
  context,
  relatedImage,
}: InterviewQuestionProps) {
  return (
    <div className="max-w-2xl mx-auto px-4">
      {/* Related image thumbnail if question relates to specific image */}
      {relatedImage && (
        <div className="mb-4 flex justify-center md:justify-start">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden">
            <Image
              src={relatedImage.url}
              alt={relatedImage.alt}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
        </div>
      )}

      {/* Context lead-in if present */}
      {context && (
        <p className="text-lg text-folio-text-secondary mb-3 text-center md:text-left">
          {context}
        </p>
      )}

      {/* Question text - THE STYLING USER LIKES */}
      <h2 className="text-2xl md:text-3xl font-serif italic text-folio-text-primary leading-relaxed text-center md:text-left">
        {question}
      </h2>
    </div>
  );
}
