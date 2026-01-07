'use client';

import { DirectoryStats as Stats } from '@/types/directory';

interface DirectoryStatsProps {
  stats: Stats;
}

export default function DirectoryStats({ stats }: DirectoryStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div 
        className="rounded-xl p-6 shadow-sm border border-white/30"
        style={{
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div className="text-[#6B6560] text-sm mb-1 font-medium">Total Products</div>
        <div className="text-3xl font-semibold text-[#2C2925]" style={{ fontFamily: 'var(--font-serif)' }}>
          {stats.totalProducts}
        </div>
      </div>
      <div 
        className="rounded-xl p-6 shadow-sm border border-white/30"
        style={{
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div className="text-[#6B6560] text-sm mb-1 font-medium">Total Vendors</div>
        <div className="text-3xl font-semibold text-[#2C2925]" style={{ fontFamily: 'var(--font-serif)' }}>
          {stats.totalVendors}
        </div>
      </div>
      <div 
        className="rounded-xl p-6 shadow-sm border border-white/30"
        style={{
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div className="text-[#6B6560] text-sm mb-1 font-medium">Projects with Tags</div>
        <div className="text-3xl font-semibold text-[#2C2925]" style={{ fontFamily: 'var(--font-serif)' }}>
          {stats.totalProjects}
        </div>
      </div>
    </div>
  );
}

