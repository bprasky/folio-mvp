'use client';

import { DirectoryStats as Stats } from '@/types/directory';

interface DirectoryStatsProps {
  stats: Stats;
}

export default function DirectoryStats({ stats }: DirectoryStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div
        className="glass-surface rounded-xl p-6"
      >
        <div className="text-folio-text-secondary text-sm mb-1 font-medium">Total Products</div>
        <div className="text-3xl font-semibold text-folio-text-primary" style={{ fontFamily: 'var(--font-headline)' }}>
          {stats.totalProducts}
        </div>
      </div>
      <div
        className="glass-surface rounded-xl p-6"
      >
        <div className="text-folio-text-secondary text-sm mb-1 font-medium">Total Vendors</div>
        <div className="text-3xl font-semibold text-folio-text-primary" style={{ fontFamily: 'var(--font-headline)' }}>
          {stats.totalVendors}
        </div>
      </div>
      <div
        className="glass-surface rounded-xl p-6"
      >
        <div className="text-folio-text-secondary text-sm mb-1 font-medium">Projects with Tags</div>
        <div className="text-3xl font-semibold text-folio-text-primary" style={{ fontFamily: 'var(--font-headline)' }}>
          {stats.totalProjects}
        </div>
      </div>
    </div>
  );
}

