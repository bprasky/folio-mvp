"use client";

import { useEffect, useState } from "react";

type Props = {
  badgeToken: string;
  userName: string;
  eventId: string;
};

export default function EventBadgeQR({ badgeToken, userName, eventId }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const slug = userName.replace(/\s+/g, "").toLowerCase();
  const badgeUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/monograph/${slug}?event=${eventId}&badge=${badgeToken}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(badgeUrl, {
        width: 240,
        margin: 2,
        color: { dark: "#1c1917", light: "#ffffff" },
      }).then((url: string) => {
        if (!cancelled) setQrDataUrl(url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, badgeUrl]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1 rounded-full border border-emerald-300 text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
      >
        My Badge
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-xl">
        <h3 className="text-lg font-semibold text-[var(--text-primary,#1c1917)] mb-1">
          Your Event Badge
        </h3>
        <p className="text-sm text-[var(--text-secondary,#78716c)] mb-4">
          Show this QR code at check-in
        </p>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="Badge QR Code"
            className="mx-auto w-60 h-60 rounded-lg"
          />
        ) : (
          <div className="mx-auto w-60 h-60 rounded-lg bg-stone-100 animate-pulse" />
        )}
        <p className="text-xs text-[var(--text-tertiary,#a8a29e)] mt-3 break-all">
          {userName}
        </p>
        <button
          onClick={() => setOpen(false)}
          className="mt-4 w-full py-2.5 rounded-lg bg-stone-100 text-stone-700 font-medium text-sm hover:bg-stone-200 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
