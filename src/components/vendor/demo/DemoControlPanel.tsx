"use client";
import { useDemoStore } from "@/lib/demo/demoStore";

export function DemoControlPanel() {
  const {
    demoMode,
    engagementLift,
    saveTagRate,
    marketMix,
    bias,
    setDemoMode,
    setEngagementLift,
    setSaveTagRate,
    setMarketMix,
    setBias,
    resetDemo
  } = useDemoStore();

  return (
    <div className="fixed bottom-4 right-4 w-[340px] rounded-2xl border border-white/10 bg-[rgba(16,18,24,0.85)] backdrop-blur-xl p-4 shadow-2xl text-white space-y-4 z-50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Demo Mode</h3>
        <button
          onClick={() => setDemoMode(!demoMode)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            demoMode 
              ? 'bg-emerald-500 text-white' 
              : 'bg-white/20 text-white/70 hover:bg-white/30'
          }`}
        >
          {demoMode ? 'ON' : 'OFF'}
        </button>
      </div>

      {demoMode && (
        <div className="space-y-4">
          {/* Engagement Lift */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Engagement Lift</span>
              <span className="text-emerald-400">+{engagementLift}%</span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              value={engagementLift}
              onChange={(e) => setEngagementLift(Number(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Save Tag Rate */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Save→Tag Rate</span>
              <span className="text-blue-400">{saveTagRate}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={saveTagRate}
              onChange={(e) => setSaveTagRate(Number(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Market Mix */}
          <div>
            <div className="text-xs mb-2">Market Mix</div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>NYC</span>
                  <span className="text-orange-400">{marketMix.nyc}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={marketMix.nyc}
                  onChange={(e) => setMarketMix({ nyc: Number(e.target.value) })}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Miami</span>
                  <span className="text-pink-400">{marketMix.miami}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={marketMix.miami}
                  onChange={(e) => setMarketMix({ miami: Number(e.target.value) })}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>LA</span>
                  <span className="text-purple-400">{marketMix.la}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={marketMix.la}
                  onChange={(e) => setMarketMix({ la: Number(e.target.value) })}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>
          </div>

          {/* Room Bias */}
          <div>
            <div className="text-xs mb-2">Room Bias</div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Kitchen</span>
                  <span className="text-yellow-400">{bias.kitchen}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bias.kitchen}
                  onChange={(e) => setBias({ kitchen: Number(e.target.value) })}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Bath</span>
                  <span className="text-cyan-400">{bias.bath}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bias.bath}
                  onChange={(e) => setBias({ bath: Number(e.target.value) })}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Outdoor</span>
                  <span className="text-green-400">{bias.outdoor}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bias.outdoor}
                  onChange={(e) => setBias({ outdoor: Number(e.target.value) })}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={resetDemo}
            className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
          >
            Reset Demo
          </button>
        </div>
      )}
    </div>
  );
}





