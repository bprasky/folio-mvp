import { NextResponse } from 'next/server';

/**
 * AI Analyst API - Returns contextual answers about recommendations
 * For now, returns deterministic placeholder answers based on sectionId
 * Later: integrate with real LLM (OpenAI, Anthropic, etc.)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sectionId, context, question } = body ?? {};

    // TODO: integrate real LLM later; for now, return a deterministic placeholder.
    let answer =
      'This recommendation is based on your current event performance, designer behavior, and product usage.';

    if (sectionId === 'events') {
      const eventName = context?.bundle?.opportunityMap?.find?.((n: any) => n.type === 'event')?.label;
      answer = `I recommended focusing on ${eventName ?? 'your top event'} because it is currently generating a disproportionate share of your saves and tags relative to other events. Increasing your presence there is likely to yield outsized returns compared to spreading budget evenly.`;
    } else if (sectionId === 'projects') {
      answer = `The recommendation focuses on designers and SKUs that are already performing well in your projects. Building deeper relationships with those designers and doubling down on those SKUs is typically more efficient than trying to unlock entirely new segments from scratch.`;
    } else if (sectionId === 'designerFunnel') {
      answer = `Expanding your high-intent designer cohort is powerful because those designers are closest to specification decisions. Providing them with targeted support (samples, training, co-marketing) tends to move the needle faster than broad outreach alone.`;
    } else if (sectionId === 'revenue') {
      answer = `The projected influence value and suggested actions are tied to the drivers identified in your current behavior: event performance, SKU saves, and designer engagement. Adjusting spend in those areas will have the most direct impact on your forecast.`;
    }

    return NextResponse.json(
      {
        answer,
        echo: { sectionId, question },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[AI ANALYST API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process question' },
      { status: 500 }
    );
  }
}


