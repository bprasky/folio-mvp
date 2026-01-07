export type Confidence = 'High' | 'Medium' | 'Test';

export interface AiImpact {
  expectedLiftUsd: number;     // e.g. 240000
  confidence: Confidence;      // High/Medium/Test
  decayPctByDay: number;       // e.g. 20 (after day 7)
}

export interface AiReceiptItem {
  label: string;               // "NYC share"
  value: string;               // "38.2%"
  hint?: string;               // "+7.5% vs prior"
  section?: 'roomPhase'|'geo'|'products'|'designers'|'timeline';
  anchorKey?: string;          // "Bath|Procurement", "Miami", productId, firmId, etc.
}

export interface AiInsight {
  id: string;
  title: string;               // "Close now in New York"
  body: string;                // 1–2 sentences
  impact: AiImpact;
  receipts: AiReceiptItem[];   // 3–5 data receipts
  action: { type: 'promo'|'specPack'|'sampleKit'|'invite'|'scheduleReview'|'localizeAssets', label: string, payload?: any };
  guardrails?: { inventory?: 'tight'|'ok', margin?: 'low'|'med'|'high' };
}

export type ModuleType = 'flow'|'opportunity'|'tts'|'roomPhase'|'timeline'|'geo'|'products'|'designers'|'materials'|'benchmarks';

export interface ModuleInsight {
  module: ModuleType;
  what: string;    // 1 sentence - What happened
  why: string;     // 1 sentence - Why it matters
  next: { label: string; type: 'promo'|'specPack'|'sampleKit'|'localizeAssets'|'invite'|'scheduleReview'; payload?: any }[];
  receipts: AiReceiptItem[];
  impact?: AiImpact;
}
