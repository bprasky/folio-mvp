import { create } from 'zustand';

interface MarketMix {
  nyc: number;
  miami: number;
  la: number;
}

interface RoomBias {
  kitchen: number;
  bath: number;
  outdoor: number;
}

interface DemoState {
  demoMode: boolean;
  engagementLift: number; // -50 to +50
  saveTagRate: number; // 0 to 100
  marketMix: MarketMix;
  bias: RoomBias;
  
  // Setters
  setDemoMode: (mode: boolean) => void;
  setEngagementLift: (lift: number) => void;
  setSaveTagRate: (rate: number) => void;
  setMarketMix: (mix: Partial<MarketMix>) => void;
  setBias: (bias: Partial<RoomBias>) => void;
  resetDemo: () => void;
}

export const useDemoStore = create<DemoState>((set: any) => ({
  demoMode: false,
  engagementLift: 0,
  saveTagRate: 45,
  marketMix: { nyc: 40, miami: 30, la: 30 },
  bias: { kitchen: 40, bath: 35, outdoor: 25 },
  
  setDemoMode: (mode) => set({ demoMode: mode }),
  setEngagementLift: (lift) => set({ engagementLift: Math.max(-50, Math.min(50, lift)) }),
  setSaveTagRate: (rate) => set({ saveTagRate: Math.max(0, Math.min(100, rate)) }),
  setMarketMix: (mix) => set((state: any) => ({ 
    marketMix: { ...state.marketMix, ...mix } 
  })),
  setBias: (bias) => set((state: any) => ({ 
    bias: { ...state.bias, ...bias } 
  })),
  resetDemo: () => set({
    demoMode: false,
    engagementLift: 0,
    saveTagRate: 45,
    marketMix: { nyc: 40, miami: 30, la: 30 },
    bias: { kitchen: 40, bath: 35, outdoor: 25 },
  }),
}));
