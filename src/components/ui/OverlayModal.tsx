"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function OverlayModal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => router.back()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute inset-x-0 top-6 mx-auto max-w-6xl",
          "rounded-2xl bg-[var(--bg-base)] shadow-2xl ring-1 ring-[var(--ridge-outer)] dark:bg-[var(--bg-base)]",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
