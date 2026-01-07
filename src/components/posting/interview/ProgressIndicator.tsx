"use client";

interface ProgressIndicatorProps {
  current: number;
  total: number;
}

export function ProgressIndicator({ current, total }: ProgressIndicatorProps) {
  return (
    <div className="text-center py-2">
      <p className="text-sm text-gray-400">
        Question {current} of {total}
      </p>
    </div>
  );
}


