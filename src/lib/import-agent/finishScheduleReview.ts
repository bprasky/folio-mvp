import type { FinishScheduleRow } from './parseFinishSchedule';

export type ScheduleMatch = { imageId: string; x: number; y: number; confidence: string; reason: string };
export type ScheduleResearch = {
  productUrl: string; productName: string; brand: string | null; exact: boolean;
  description: string | null; priceCents: number | null; sku: string | null;
  dimensions: string | null; widthIn: number | null; depthIn: number | null; heightIn: number | null;
  material: string | null; finish: string | null; imageUrl: string | null; confidence: string;
};
export type ScheduleReview = {
  state: 'queued' | 'processing' | 'done' | 'failed';
  row: FinishScheduleRow; matches: ScheduleMatch[]; warnings: string[];
  startedAt?: number; research?: ScheduleResearch | null;
};
export function scheduleReview(value: unknown): ScheduleReview | null {
  const review = (value as { finishSchedule?: ScheduleReview } | null)?.finishSchedule;
  return review?.row?.name && ['queued', 'processing', 'done', 'failed'].includes(review.state) ? review : null;
}
export function scheduleCanRun(review: ScheduleReview, retry = false, now = Date.now()) {
  return review.state === 'queued' || (retry && ['done', 'failed'].includes(review.state)) ||
    (review.state === 'processing' && now - (review.startedAt || 0) > 180_000);
}
