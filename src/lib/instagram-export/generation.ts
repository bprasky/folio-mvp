import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/models';
import { type AiErrorCode, isRetryable, statusFor, userMessageFor } from '@/lib/ai/errors';

export class SocialGenerationError extends Error {
  constructor(public code: AiErrorCode) { super(userMessageFor(code)); }
}

export async function generateSocialText(prompt: string, maxTokens: number): Promise<string> {
  // Match the canonical editorial provider gate, including its explicit off switch.
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_ENABLED === 'false') {
    throw new SocialGenerationError('LLM_DISABLED');
  }
  try {
    const response = await new Anthropic({ maxRetries: 0, timeout: 45000 }).messages.create({
      model: MODELS.sonnet, thinking: { type: 'disabled' }, max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'max_tokens') throw new SocialGenerationError('LLM_TRUNCATED');
    const text = response.content.filter(block => block.type === 'text').map(block => block.text).join('\n').trim();
    if (!text) throw new SocialGenerationError('LLM_EMPTY_RESPONSE');
    return text;
  } catch (error) {
    if (error instanceof SocialGenerationError) throw error;
    const status = (error as { status?: number }).status;
    throw new SocialGenerationError(status === 401 || status === 403 ? 'LLM_AUTH_FAILED'
      : status === 429 ? 'LLM_RATE_LIMITED' : status === 529 ? 'LLM_OVERLOADED'
        : (error as Error).name === 'APIConnectionTimeoutError' ? 'LLM_TIMEOUT' : 'LLM_CALL_FAILED');
  }
}

export function parseSocialOptions(text: string, schema: z.ZodType<string[]>): string[] {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return schema.parse(JSON.parse(match ? match[0] : text));
  } catch { throw new SocialGenerationError('LLM_JSON_PARSE'); }
}

export function socialGenerationFailure(error: unknown) {
  const code = error instanceof SocialGenerationError ? error.code : 'LLM_CALL_FAILED';
  return { status: statusFor(code), body: { error: userMessageFor(code), code, retryable: isRetryable(code) } };
}

/** Select actual published prose, never serialized IDs or another room's chapter. */
export function extractTextFromBlocks(blocks: unknown): string {
  if (typeof blocks === 'string') return blocks;
  if (Array.isArray(blocks)) return blocks.map(extractTextFromBlocks).filter(Boolean).join('\n\n');
  if (!blocks || typeof blocks !== 'object') return '';
  const record = blocks as Record<string, unknown>;
  return ['text', 'content', 'children', 'lead', 'kicker', 'deck', 'introduction', 'body', 'sections', 'galleryChapters']
    .map(key => extractTextFromBlocks(record[key])).filter(Boolean).join('\n\n');
}

export function publishedRoomSource(blocks: unknown, roomId: string, imageIds: string[]): unknown {
  if (!blocks || typeof blocks !== 'object' || Array.isArray(blocks)) return null;
  const chapters = (blocks as Record<string, unknown>).galleryChapters;
  if (!Array.isArray(chapters)) return null;
  const matching = chapters.filter(chapter => chapter && typeof chapter === 'object' &&
    (chapter.roomId === roomId || (!chapter.roomId && Array.isArray(chapter.imageIds) &&
      chapter.imageIds.some((id: string) => imageIds.includes(id)))));
  return extractTextFromBlocks(matching).trim() ? matching : null;
}
