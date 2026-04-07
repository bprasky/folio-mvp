"use client";

import { useEffect, useState } from "react";
import type { ScanResultData, Attendee, ScannedProduct } from "./CheckInPageClient";

type Props = {
  result: ScanResultData;
  eventId: string;
  onScanNext: () => void;
  onWalkInAdded: () => void;
};

function AttendeeCard({ attendee }: { attendee: Attendee }) {
  return (
    <div className="flex items-center gap-3 mt-3">
      {attendee.profileImage ? (
        <img
          src={attendee.profileImage}
          alt={attendee.name}
          className="w-12 h-12 rounded-full object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center text-folio-text-tertiary font-medium text-lg">
          {attendee.name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-[var(--text-primary,#1c1917)] truncate">
          {attendee.name}
        </p>
        {attendee.title && (
          <p className="text-sm text-[var(--text-secondary,#78716c)] truncate">
            {attendee.title}
          </p>
        )}
        {attendee.orgName && (
          <p className="text-sm text-[var(--text-secondary,#78716c)] truncate">
            {attendee.orgName}
          </p>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: ScannedProduct }) {
  return (
    <div className="flex items-center gap-3 mt-3">
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-16 h-16 rounded-lg object-cover"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-surface-elevated flex items-center justify-center text-folio-text-tertiary">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-[var(--text-primary,#1c1917)] truncate">
          {product.name}
        </p>
        {product.vendorName && (
          <p className="text-sm text-[var(--text-secondary,#78716c)] truncate">
            {product.vendorName}
          </p>
        )}
        {product.price != null && (
          <p className="text-sm font-medium text-[var(--text-primary,#1c1917)]">
            ${product.price.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ScanResult({
  result,
  eventId,
  onScanNext,
  onWalkInAdded,
}: Props) {
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  // Auto-return to camera after 3s for success/already states
  useEffect(() => {
    if (
      result.status === "checked_in" ||
      result.status === "already_checked_in" ||
      result.status === "product_scanned" ||
      result.status === "product_already_scanned"
    ) {
      const timer = setTimeout(onScanNext, 3000);
      return () => clearTimeout(timer);
    }
    if (
      result.status === "invalid_qr" ||
      result.status === "wrong_event" ||
      result.status === "product_not_found"
    ) {
      const timer = setTimeout(onScanNext, 2000);
      return () => clearTimeout(timer);
    }
  }, [result.status, onScanNext]);

  async function handleAddWalkIn() {
    if (result.status !== "not_found") return;
    setAddingWalkIn(true);
    onScanNext();
  }

  if (result.status === "checked_in") {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5">
        <p className="text-emerald-800 font-bold text-lg">WELCOME</p>
        <AttendeeCard attendee={result.attendee} />
        <p className="text-sm text-emerald-700 mt-3">
          Checked in at {formatTime(result.checkedInAt)}
        </p>
        <button
          onClick={onScanNext}
          className="mt-4 w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors"
        >
          Scan Next
        </button>
      </div>
    );
  }

  if (result.status === "already_checked_in") {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">
        <p className="text-amber-800 font-bold text-lg">ALREADY CHECKED IN</p>
        <AttendeeCard attendee={result.attendee} />
        <p className="text-sm text-amber-700 mt-3">
          Originally checked in at {formatTime(result.checkedInAt)}
        </p>
        <button
          onClick={onScanNext}
          className="mt-4 w-full py-2.5 rounded-lg bg-amber-600 text-white font-medium text-sm hover:bg-amber-700 transition-colors"
        >
          Scan Next
        </button>
      </div>
    );
  }

  if (result.status === "not_found") {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-5">
        <p className="text-red-800 font-bold text-lg">NO RSVP FOUND</p>
        <p className="text-sm text-red-700 mt-2">
          Valid Folio badge, but no RSVP for this event.
        </p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={onScanNext}
            className="flex-1 py-2.5 rounded-lg bg-surface-elevated text-folio-text-secondary font-medium text-sm hover:bg-surface-elevated transition-colors"
          >
            Scan Next
          </button>
        </div>
      </div>
    );
  }

  // Product scan results
  if (result.status === "product_scanned") {
    return (
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-5">
        <p className="text-blue-800 font-bold text-lg">PRODUCT SAVED</p>
        <ProductCard product={result.product} />
        <p className="text-sm text-blue-700 mt-3">
          Added to your event collection.
        </p>
        <button
          onClick={onScanNext}
          className="mt-4 w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors"
        >
          Scan Next
        </button>
      </div>
    );
  }

  if (result.status === "product_already_scanned") {
    return (
      <div className="rounded-xl bg-sky-50 border border-sky-200 p-5">
        <p className="text-sky-800 font-bold text-lg">ALREADY SCANNED</p>
        <ProductCard product={result.product} />
        <p className="text-sm text-sky-700 mt-3">
          This product is already in your collection.
        </p>
        <button
          onClick={onScanNext}
          className="mt-4 w-full py-2.5 rounded-lg bg-sky-600 text-white font-medium text-sm hover:bg-sky-700 transition-colors"
        >
          Scan Next
        </button>
      </div>
    );
  }

  if (result.status === "product_not_found") {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-5">
        <p className="text-red-800 font-bold text-lg">PRODUCT NOT FOUND</p>
        <p className="text-sm text-red-700 mt-2">
          This product QR code could not be matched.
        </p>
        <button
          onClick={onScanNext}
          className="mt-4 w-full py-2.5 rounded-lg bg-surface-elevated text-folio-text-secondary font-medium text-sm hover:bg-stone-400 transition-colors"
        >
          Scan Next
        </button>
      </div>
    );
  }

  // invalid_qr or wrong_event
  return (
    <div className="rounded-xl bg-surface-elevated border border-folio-border-subtle p-5">
      <p className="text-folio-text-secondary font-bold text-lg">Unrecognized QR Code</p>
      <p className="text-sm text-folio-text-tertiary mt-2">
        This QR code is not a valid Folio badge or product. Try again.
      </p>
      <button
        onClick={onScanNext}
        className="mt-4 w-full py-2.5 rounded-lg bg-surface-elevated text-folio-text-secondary font-medium text-sm hover:bg-stone-400 transition-colors"
      >
        Scan Next
      </button>
    </div>
  );
}
