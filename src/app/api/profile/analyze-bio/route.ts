export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import Anthropic from '@anthropic-ai/sdk';
import {
  ORG_ABOUT_QUESTIONS,
  PERSONAL_ABOUT_QUESTIONS,
} from '@/lib/org-onboarding/conversational-interview-questions';
import { MODELS } from '@/lib/ai/models';

const anthropic = new Anthropic();

export interface QuestionCoverageResult {
  questionId: string;
  depth: 'full' | 'partial' | 'none';
  extractedAnswer: string | null;
  gapNote: string | null;
}

/**
 * POST /api/profile/analyze-bio
 *
 * Analyzes imported bio text against interview questions to determine coverage.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bioText, context } = await request.json();

    if (!bioText || typeof bioText !== 'string') {
      return NextResponse.json({ error: 'bioText is required' }, { status: 400 });
    }

    if (!context || !['org', 'personal'].includes(context)) {
      return NextResponse.json({ error: 'context must be "org" or "personal"' }, { status: 400 });
    }

    const questions = context === 'org' ? ORG_ABOUT_QUESTIONS : PERSONAL_ABOUT_QUESTIONS;

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      thinking: { type: 'disabled' },
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are analyzing an interior designer's existing bio to determine which
profile interview questions it already answers — and how well.

BIO TEXT:
${bioText}

INTERVIEW QUESTIONS:
${questions.map((q, i) => `${i + 1}. [${q.id}] ${q.question}`).join('\n')}

For each question, return a JSON array with this structure:
{
  "questionId": string,
  "depth": "full" | "partial" | "none",
  "extractedAnswer": string | null,
  "gapNote": string | null
}

DEPTH DEFINITIONS:
- "full": The bio answers this clearly and with specificity. No follow-up needed.
- "partial": The bio touches on this but lacks specificity or depth.
              A short follow-up would meaningfully enrich it.
- "none": The bio does not address this at all.

IMPORTANT:
- Generic statements ("passionate about design", "client-focused") do not
   count as answering a question — mark as "none" even if topically related.
- "partial" should be your most common output. Most bios gesture at things
   without going deep.
- extractedAnswer: quote or closely paraphrase what the bio actually says
   about this topic. null if depth is "none".
- gapNote: one sentence describing what's still missing. null if depth is "full".

Return only valid JSON array. No preamble, no markdown fences.`,
      }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const coverage: QuestionCoverageResult[] = JSON.parse(cleaned);

    return NextResponse.json({ coverage });
  } catch (error) {
    console.error('[POST /api/profile/analyze-bio] Error:', error);
    return NextResponse.json({ error: 'Failed to analyze bio' }, { status: 500 });
  }
}
