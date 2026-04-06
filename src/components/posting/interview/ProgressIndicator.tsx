"use client";

interface ProgressIndicatorProps {
  current: number;
  total: number;
}

export function ProgressIndicator({ current, total }: ProgressIndicatorProps) {
  return (
    <div className="text-center py-2">
      <p className="text-sm text-folio-text-tertiary">
        Question {current} of {total}
      </p>
    </div>
  );
}


