export const FLOW_BASELINES = {
  event_to_saves: 2.1,   // 210% (example cohort median)
  saves_to_boards: 0.32, // 32%
  boards_to_tags: 0.41,  // 41%
  tags_to_value: 0.12    // 12%
};

export interface FlowBenchmark {
  actual: number;
  baseline: number;
  delta: number;
  deltaLabel: string;
  fix?: string;
  expectedLiftPct?: number;
}

export function computeFlowBenchmark(
  actualValue: number,
  prevValue: number,
  baselineRate: number
): FlowBenchmark {
  const actualRate = prevValue > 0 ? actualValue / prevValue : 0;
  const delta = actualRate - baselineRate;
  const deltaLabel = delta >= 0 ? `+${(delta * 100).toFixed(0)} pts` : `${(delta * 100).toFixed(0)} pts`;
  
  return {
    actual: actualRate,
    baseline: baselineRate,
    delta,
    deltaLabel,
    fix: delta < 0 ? 'spec pack' : undefined,
    expectedLiftPct: delta < 0 ? Math.abs(delta * 100 * 0.75) : undefined // 75% of gap recoverable
  };
}








