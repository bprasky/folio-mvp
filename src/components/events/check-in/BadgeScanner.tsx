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

function parseQrCode(
  raw: string
):
  | { type: "badge"; badgeToken: string }
  | { type: "product"; productId: string }
  | null {
  // folio:// protocol
  if (raw.startsWith("folio://product/")) {
    const productId = raw.replace("folio://product/", "").trim();
    return productId ? { type: "product", productId } : null;
  }

  // URL-based badge QR (existing format)
  const badge = parseBadgeUrl(raw);
  if (badge?.badgeToken) return { type: "badge", badgeToken: badge.badgeToken };

  return null;
}

type Props = {
  eventId: string;
  onScanResult: (result: ScanResultData) => void;
};

export default function BadgeScanner({ eventId, onScanResult }: Props) {
  const scannerRef = useRef<any>(null);
  const processingRef = useRef(false);

  const pauseScanner = useCallback(() => {
    if (scannerRef.current) {
      try {
        scannerRef.current.pause(true);
      } catch {
        // scanner may already be paused
      }
    }
  }, []);

  const handleScan = useCallback(
    async (decodedText: string) => {
      if (processingRef.current) return;
      processingRef.current = true;

      const parsed = parseQrCode(decodedText);

      if (!parsed) {
        onScanResult({ status: "invalid_qr" });
        processingRef.current = false;
        return;
      }

      if (parsed.type === "badge") {
        // Existing badge check-in flow
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
      } else {
        // Product scan flow
        try {
          const res = await fetch(`/api/events/${eventId}/scan`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: parsed.productId }),
          });
          const data = await res.json();

          if (res.status === 404) {
            onScanResult({ status: "product_not_found" });
          } else if (res.status === 403) {
            onScanResult({ status: "invalid_qr" });
          } else {
            onScanResult(data as ScanResultData);
          }
        } catch {
          onScanResult({ status: "product_not_found" });
        }
      }

      pauseScanner();
      processingRef.current = false;
    },
    [eventId, onScanResult, pauseScanner]
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
        Scan a Badge or Product QR
      </p>
    </div>
  );
}
