// Temporary shim: keep old imports alive while we migrate.
// New visual-first card:
import VisualActionCard from './VisualActionCard';
import { ReactNode } from 'react';

export function ChartCard({
  title, subtitle, kpi, tone='perf', children, footer, useScaleToFit=true
}: { 
  title:string; 
  subtitle?:string;
  kpi?:ReactNode; 
  tone?:'engage'|'perf'|'opp'|'risk'; 
  children:ReactNode; 
  footer?:ReactNode;
  useScaleToFit?: boolean;
}) {
  return (
    <VisualActionCard
      title={title}
      tone={tone}
      visual={children}
      what={subtitle}
      why={footer ? String(footer) : undefined}
    />
  );
}

export { ChartCard as default };