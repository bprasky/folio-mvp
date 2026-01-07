import { useDemoStore } from "./demoStore";

export function useDemoDerived() {
  const { demoMode, engagementLift, saveTagRate, marketMix, bias } = useDemoStore();
  
  // Scalars
  const liftScalar = demoMode ? 1 + (engagementLift / 100) : 1;        // e.g., +18% => 1.18
  const saveTagTarget = demoMode ? saveTagRate : null;                  // override % if set

  // Market weights (normalized)
  const totalM = Math.max(1, marketMix.nyc + marketMix.miami + marketMix.la);
  const w = demoMode ? {
    nyc: marketMix.nyc / totalM,
    miami: marketMix.miami / totalM,
    la: marketMix.la / totalM
  } : { nyc: 0, miami: 0, la: 0 };

  // Bias (rooms)
  const totalB = Math.max(1, bias.kitchen + bias.bath + bias.outdoor);
  const b = demoMode ? {
    kitchen: bias.kitchen / totalB,
    bath: bias.bath / totalB,
    outdoor: bias.outdoor / totalB
  } : { kitchen: 0, bath: 0, outdoor: 0 };

  return { demoMode, liftScalar, saveTagTarget, w, b };
}





