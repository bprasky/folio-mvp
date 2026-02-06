'use client';

import { FaUserPlus } from 'react-icons/fa';

interface NewDesignersEngagedCardProps {
  newDesigners: number;
}

export default function NewDesignersEngagedCard({ newDesigners }: NewDesignersEngagedCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">New Designers Engaged (Last 30 Days)</h2>
        <p className="text-4xl font-bold text-[var(--accent)] mt-2">{newDesigners.toLocaleString()}</p>
      </div>
      <div className="bg-[var(--accent)]/10 p-3 rounded-full">
        <FaUserPlus className="text-[var(--accent)] text-3xl" />
      </div>
    </div>
  );
} 