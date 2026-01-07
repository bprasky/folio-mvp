'use client';
import React from 'react';

export default function ActionPill({ label, onClick }:{ label: string; onClick: ()=>void }) {
  return (
    <button onClick={onClick}
      className="chip px-3 py-1.5 text-sm rounded-lg hover:bg-white/10">
      {label}
    </button>
  );
}
