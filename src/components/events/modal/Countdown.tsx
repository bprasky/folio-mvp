"use client";

import React from "react";

export default function Countdown({ startAt }: { startAt: string | null }) {
  const [label, setLabel] = React.useState<string>("");

  React.useEffect(() => {
    if (!startAt) return;
    const start = new Date(startAt).getTime();
    const t = setInterval(() => {
      const now = Date.now();
      const diff = start - now;
      if (diff <= 0) {
        setLabel("Starts soon");
        clearInterval(t);
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      if (d > 0) setLabel(`${d}d ${h}h left`);
      else if (h > 0) setLabel(`${h}h ${m}m left`);
      else setLabel(`${m}m left`);
    }, 30_000);
    return () => clearInterval(t);
  }, [startAt]);

  if (!label) return null;
  return (
    <span className="rounded-full bg-white/12 px-2.5 py-1 text-xs tracking-wide">
      {label}
    </span>
  );
}


