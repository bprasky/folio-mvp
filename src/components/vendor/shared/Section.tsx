import React from 'react';
import { AIBadge } from './AIBadge';

interface SectionProps {
  title: string;
  ai?: boolean;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Section component for organizing dashboard content with optional AI badge
 */
export const Section: React.FC<SectionProps> = ({ title, ai, subtitle, children }) => (
  <section className="space-y-2">
    <div className="flex items-center gap-2">
      <h3 className="text-lg font-semibold text-folio-text-primary">{title}</h3>
      {ai && <AIBadge />}
    </div>
    {subtitle && <p className="folio-ui text-folio-text-secondary">{subtitle}</p>}
    <div className="grid gap-3">{children}</div>
  </section>
);

