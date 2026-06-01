'use client';

import { FileSpreadsheet, MousePointerClick, Clock, X } from 'lucide-react';

interface MaterialsStepProps {
  open: boolean;
  onClose: () => void;
  /** Route into the existing finish-schedule import + AI verification queue. */
  onUploadFinishSchedule: () => void;
  /** Open the manual click-to-tag surface. */
  onTagByHand: () => void;
}

/**
 * Materials step (spec 20 §3d) — the in-brand replacement for the off-brand
 * blue "Before Your Interview" modal. Warm canvas, three selectable cards,
 * gold active outline. No blue, no gradient interrupt.
 */
export default function MaterialsStep({
  open,
  onClose,
  onUploadFinishSchedule,
  onTagByHand,
}: MaterialsStepProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 glass-backdrop" onClick={onClose} />

      <div className="relative warm-mesh rounded-2xl bg-surface-ground border border-folio-border-subtle shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="relative z-[1] p-7">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 text-folio-text-tertiary hover:text-folio-text-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="font-headline italic text-3xl text-folio-text-primary">
            Add your materials
          </h2>
          <p className="folio-body text-folio-text-secondary mt-1.5 mb-6">
            Upload a finish schedule and we match products to your photos. Or tag by hand.
          </p>

          <div className="space-y-3">
            <OptionCard
              icon={<FileSpreadsheet className="w-5 h-5 text-[var(--accent)]" />}
              title="Upload finish schedule"
              sub="PDF, PowerPoint, Excel, or CSV. We match products to your photos."
              onClick={() => {
                onClose();
                onUploadFinishSchedule();
              }}
            />
            <OptionCard
              icon={<MousePointerClick className="w-5 h-5 text-[var(--accent)]" />}
              title="Tag by hand"
              sub="Mark products directly on each photo."
              onClick={() => {
                onClose();
                onTagByHand();
              }}
            />
            <OptionCard
              icon={<Clock className="w-5 h-5 text-folio-text-tertiary" />}
              title="Add later"
              sub="Keep this as a draft. You can publish once products are tagged."
              onClick={onClose}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionCard({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="glass-surface glass-surface-sm w-full text-left p-4 rounded-xl border border-folio-border-subtle hover:border-[var(--folio-gold)] transition-colors"
    >
      <div className="relative z-[1] flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <h3 className="folio-ui font-semibold text-folio-text-primary">{title}</h3>
          <p className="folio-meta text-folio-text-secondary mt-0.5">{sub}</p>
        </div>
      </div>
    </button>
  );
}
