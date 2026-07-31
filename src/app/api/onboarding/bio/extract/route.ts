export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { MODELS } from '@/lib/ai/models';

// Step 3 (17_ONBOARDING_FLOW). Single free-text bio → structured extraction.
// Low-confidence fields are returned as null rather than guessed.

let anthropic: Anthropic | null = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic();
}

const bodySchema = z.object({
  bio: z.string().trim().min(10).max(4000),
});

interface ProposedFields {
  location: string | null;
  title: string | null;
  specialties: string[];
  bio: string | null;
}

function fallbackFromBio(bio: string): ProposedFields {
  return { location: null, title: null, specialties: [], bio: bio.trim() };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { bio } = parsed.data;

  if (!anthropic) {
    return NextResponse.json({ proposed: fallbackFromBio(bio) });
  }

  try {
    const message = await anthropic.messages.create({
      model: MODELS.sonnet,
      thinking: { type: 'disabled' },
      max_tokens: 1024,
      system: `You extract structured profile fields from an interior design professional's free-text bio.

Return ONLY a JSON object with these keys:
  location     — "City, Region" string, or null if not stated
  title        — professional title (e.g., "Principal Designer", "Founding Architect"), or null if not stated
  specialties  — array of short lowercase tags (e.g., ["residential", "hospitality", "adaptive_reuse"]); empty array if none stated
  bio          — the user's bio, lightly cleaned but preserved close to as written. Keep their voice.

Rules:
- If you are not confident about a field, set it to null (or [] for specialties). Do not guess.
- Do NOT invent specialties the user did not mention.
- "bio" should always be a string; do not return null for bio.
- Output strictly valid JSON. No markdown, no commentary.`,
      messages: [
        {
          role: 'user',
          content: bio,
        },
      ],
    });

    const text =
      message.content
        .filter((c): c is Anthropic.TextBlock => c.type === 'text')
        .map((c) => c.text)
        .join('\n') || '';

    // Strip code fences if model returned them despite the instruction.
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let proposed: ProposedFields;
    try {
      const raw = JSON.parse(cleaned);
      proposed = {
        location:
          typeof raw.location === 'string' && raw.location.trim()
            ? raw.location.trim()
            : null,
        title:
          typeof raw.title === 'string' && raw.title.trim()
            ? raw.title.trim()
            : null,
        specialties: Array.isArray(raw.specialties)
          ? raw.specialties.filter((s: unknown): s is string => typeof s === 'string').slice(0, 12)
          : [],
        bio:
          typeof raw.bio === 'string' && raw.bio.trim()
            ? raw.bio.trim()
            : bio.trim(),
      };
    } catch {
      proposed = fallbackFromBio(bio);
    }

    return NextResponse.json({ proposed });
  } catch (err) {
    console.error('[bio/extract] Claude call failed:', err);
    return NextResponse.json({ proposed: fallbackFromBio(bio) });
  }
}
