import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { callLLM } from '@/lib/posting/llmClient';
import { MODELS } from '@/lib/ai/models';

export async function transcribeRecording(file: File) {
  if (!process.env.OPENAI_API_KEY) throw new Error('Transcription unavailable');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).audio.transcriptions.create({ file, model: 'whisper-1', response_format: 'verbose_json', timestamp_granularities: ['segment'] });
}

export async function extractRecordingQuotes(interviewSession: { project: { title: string | null; description: string | null } | null; product: { name: string; brand: string | null } | null }, transcriptSegments: Array<{start: number; end: number; text: string}>, useCases: string[]): Promise<unknown[]> {
 const fullTranscript = transcriptSegments.map(s => s.text).join(' ');
      // Build extraction prompt
      const systemPrompt = `You are a quote extraction assistant for Folio, a premium interior design platform. Extract the best quotes from interview transcripts that capture design philosophy, material decisions, and authentic designer insights.`;

      const userPrompt = `Extract 2-5 best quotes from this interview transcript.

Context:
${interviewSession.project ? `Project: ${interviewSession.project.title} - ${interviewSession.project.description || ""}` : ""}
${interviewSession.product ? `Product: ${interviewSession.product.brand} ${interviewSession.product.name}` : ""}

Transcript:
${fullTranscript}

Segment timestamps:
${transcriptSegments.map((s, i) => `[${i}] ${s.start}ms-${s.end}ms: ${s.text}`).join("\n")}

Requirements:
- Extract quotes that are ${useCases.join(" or ")} quality
- Return EXACT timestamp ranges that map to transcript segment boundaries
- Quotes must be verbatim from transcript. Copy the speaker's exact words. Do not clean up, tidy, condense, re-punctuate or smooth the language for readability
- Each quote should be 1-3 sentences, emotionally resonant or insightfully specific
- Score each quote 0-1 based on quality (designer insight, specificity, quotability)

Return JSON array:
[
  {
    "startMs": 12345,
    "endMs": 15678,
    "quoteText": "Exact quote text...",
    "useCase": "${useCases[0]}",
    "score": 0.85
  }
]`;

      const anthropic = new Anthropic();
      const modelName = MODELS.sonnet;

      const extractionResult = await callLLM(
        async () => {
          return await anthropic.messages.create({
            model: modelName,
            thinking: { type: 'disabled' },
            max_tokens: 2000,
            system: systemPrompt,
            messages: [
              { role: "user", content: userPrompt },
            ],
          });
        },
        { modelName, contextHint: 'recorded-interview-extraction', baseDelayMs: 500 }
      );

      if (!extractionResult.ok) {
        const errorResult = extractionResult as { ok: false; code: string; message: string };
        throw new Error(`Extraction failed: ${errorResult.code} - ${errorResult.message}`);
      }

      // Parse extraction response
      const rawExtraction = extractionResult.data.content[0]?.type === "text" ? extractionResult.data.content[0].text : null;
      const extractionContent = rawExtraction ? rawExtraction.replace(/```json\n?|\n?```/g, "").trim() : null;
      if (!extractionContent) {
        throw new Error("No extraction content returned");
      }

      let extractionData: unknown;
      try {
        extractionData = JSON.parse(extractionContent);
      } catch (parseError) {
        // Try to extract array from response
        const arrayMatch = extractionContent.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          extractionData = { quotes: JSON.parse(arrayMatch[0]) };
        } else {
          throw new Error("Failed to parse extraction response");
        }
      }

      const quotes = extractionData && typeof extractionData === 'object' && 'quotes' in extractionData ? extractionData.quotes : extractionData;
      if (!Array.isArray(quotes) || quotes.length === 0) {
        throw new Error("No quotes extracted");
      }


 return quotes;
}
