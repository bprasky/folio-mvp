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
        className="text-[17px] leading-relaxed text-[#5C564F] mb-6"
        style={{
          fontFamily: 'var(--font-headline)',
          fontStyle: 'italic',
          fontWeight: 400,
        }}
      >
        &ldquo;{question.questionText}&rdquo;
      </p>

      {/* Answer CTA */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onAnswer(question)}
          className="px-5 py-2 rounded-lg bg-[#2C2825] text-[#FAF9F7] text-sm font-medium hover:bg-[#3D3632] transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Answer
        </button>

        {/* Provenance line */}
        <span
          className="text-[11px] text-[#A39B93] tracking-wide"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Folio &middot; Asked based on your interview
        </span>
      </div>
    </div>
  );
}
