"use client";

import { useEffect, useRef, useCallback } from "react";
import type { ScanResultData } from "./CheckInPageClient";

function parseBadgeUrl(
  url: string
): { username?: string; badgeToken?: string } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith("/monograph/")) return null;
    return {
      username: parsed.pathname.replace("/monograph/", ""),
      badgeToken: parsed.searchParams.get("badge") || undefined,
    };
  } catch {
    return null;
  }
}

type Props = {
  eventId: string;
  onScanResult: (result: ScanResultData) => void;
};

export default function BadgeScanner({ eventId, onScanResult }: Props) {
  const scannerRef = useRef<any>(null);
  const processingRef = useRef(false);

  const handleScan = useCallback(
    async (decodedText: string) => {
      if (processingRef.current) return;
      processingRef.current = true;

      const parsed = parseBadgeUrl(decodedText);
      if (!parsed || !parsed.badgeToken) {
        onScanResult({ status: "invalid_qr" });
        processingRef.current = false;
        return;
      }

      try {
        const res = await fetch(`/api/events/${eventId}/check-in/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ badgeToken: parsed.badgeToken }),
        });
        const data = await res.json();

        if (res.status === 404) {
          onScanResult({ status: "not_found" });
        } else if (res.status === 400 && data.status === "wrong_event") {
          onScanResult({ status: "wrong_event" });
        } else {
          onScanResult(data as ScanResultData);
        }
      } catch {
        onScanResult({ status: "not_found" });
      }

      // Pause scanning while showing result
      if (scannerRef.current) {
        try {
          scannerRef.current.pause(true);
        } catch {
          // scanner may already be paused
        }
      }
      processingRef.current = false;
    },
    [eventId, onScanResult]
  );

  useEffect(() => {
    let scanner: any = null;

    async function initScanner() {
      const { Html5Qrcode } = await import("html5-qrcode");
      scanner = new Html5Qrcode("badge-reader");
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => handleScan(decodedText),
          () => {} // Ignore scan errors, keep scanning
        );
      } catch (err) {
        console.error("Camera start failed:", err);
      }
    }

    initScanner();

    return () => {
      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .then(() => scanner.clear?.());
      }
    };
  }, [handleScan]);

  return (
    <div className="rounded-xl overflow-hidden bg-black mb-4">
      <div id="badge-reader" className="w-full" />
      <p className="text-center text-white/60 text-sm py-3">
        Point at a Folio Badge
      </p>
    </div>
  );
}
