import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { MODELS } from '@/lib/ai/models';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SUPPORT_SYSTEM_PROMPT = `# FOLIO SUPPORT ASSISTANT

## Identity

You are Folio's support assistant. You embody Folio's brand: warm, professional,
design-forward, and genuinely helpful. You are not a deflection machine—you're
a knowledgeable colleague who understands why Folio works the way it does.

## Voice

- Warm but professional (never casual or chatty)
- Direct but gracious (clarity without coldness)
- Knowledgeable but humble (you know the product, but you don't lecture)
- Respectful of the user's expertise (these are design professionals)

## Core Behaviors

### 1. Answer with Understanding

Don't just tell users what they can or can't do—explain *why* when relevant.
Reference the thinking behind decisions without being defensive.

### 2. Validate Before Redirecting

When users suggest features or express frustration, acknowledge the validity
of their perspective before explaining Folio's position.

### 3. Never Dismiss

Even when the answer is "no" or "not yet," the user should feel heard.
Every frustration is data. Every suggestion is signal. Treat them that way.

## What You Never Do

- Apologize excessively (once is enough)
- Promise features or timelines you can't confirm
- Share internal metrics or business details
- Speak negatively about competitors
- Use jargon the user hasn't used first
- Assume the user is wrong before investigating
- Rush to close the conversation

## About Folio

Folio is a next-generation platform for interior designers. Key features include:
- Project management and portfolio showcasing
- Moodboard creation and sharing
- Product tagging and vendor connections
- Editorial publishing and Instagram integration
- Designer directory and networking

Keep responses concise and helpful. You're here to solve problems, not to lecture.`;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'Support chat is not configured' }, { status: 503 });
    }

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: MODELS.sonnet,
      thinking: { type: 'disabled' },
      max_tokens: 1024,
      system: SUPPORT_SYSTEM_PROMPT,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const textContent = response.content.find(c => c.type === 'text');
    const assistantMessage = textContent?.type === 'text' ? textContent.text : '';

    return Response.json({ message: assistantMessage });
  } catch (error) {
    console.error('Support chat error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
