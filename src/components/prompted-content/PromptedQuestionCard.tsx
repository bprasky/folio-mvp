'use client';

import { cn } from '@/lib/utils';

export interface PromptedQuestion {
  id: string;
  questionText: string;
  questionType: string;
  provenance: {
    sourceType: string;
    bioExcerptRef?: string;
  } | null;
  createdAt: string;
}

interface PromptedQuestionCardProps {
  question: PromptedQuestion;
  onAnswer: (question: PromptedQuestion) => void;
  className?: string;
}

export function PromptedQuestionCard({
  question,
  onAnswer,
  className,
}: PromptedQuestionCardProps) {
  return (
    <div
      className={cn(
        'rounded-[20px] border border-[rgba(139,129,120,0.15)] p-6 transition-all',
        'bg-white/80 backdrop-blur-lg',
        'hover:border-[rgba(139,129,120,0.3)] hover:shadow-sm',
        className
      )}
    >
      {/* Question text — Cormorant Garamond Italic */}
      <p
        className="text-[var(--type-body)] leading-relaxed text-folio-text-secondary mb-6"
        style={{
          fontFamily: 'var(--font-headline)',
          fontStyle: 'italic',
          fontWeight: 'var(--w-body)',
        }}
      >
        &ldquo;{question.questionText}&rdquo;
      </p>

      {/* Answer CTA */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onAnswer(question)}
          className="px-5 py-2 rounded-lg bg-folio-text-primary text-surface-ground text-sm font-medium hover:bg-[#3D3632] transition-colors"
        >
          Answer
        </button>

        {/* Provenance line */}
        <span
          className="text-[var(--type-eyebrow)] text-folio-text-tertiary tracking-wide"
        >
          Folio &middot; Asked based on your interview
        </span>
      </div>
    </div>
  );
}
