"use client";

import React from "react";
import { useRole } from "@/contexts/RoleContext";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ProcurementBarProps {
  productId: string;
  productBrand?: string;
  isVendorOwner?: boolean;
}

type RoleCTAs = {
  primary: { label: string; action: string };
  secondary: { label: string; action: string };
};

function getCTAsForRole(role: string | null, isVendorOwner: boolean): RoleCTAs {
  if (isVendorOwner || role === "vendor") {
    return {
      primary: { label: "View specifiers", action: "VENDOR_VIEW_SPECIFIERS" },
      secondary: { label: "Boost product", action: "VENDOR_BOOST_INITIATE" },
    };
  }
  if (role === "designer") {
    return {
      primary: { label: "Request quote", action: "PROCUREMENT_QUOTE_REQUEST" },
      secondary: { label: "Contact rep", action: "PROCUREMENT_REP_CONTACT" },
    };
  }
  if (role === "individual" || role === "homeowner") {
    return {
      primary: { label: "Find a designer", action: "INDIVIDUAL_FIND_DESIGNER" },
      secondary: { label: "Save product", action: "SAVE_PRODUCT" },
    };
  }
  // Guest / unauthenticated
  return {
    primary: { label: "Sign up to save", action: "GUEST_SIGNUP" },
    secondary: { label: "Learn more", action: "GUEST_LEARN_MORE" },
  };
}

/**
 * Sticky procurement bar pinned to the bottom of the product page.
 * Role-aware CTAs that change based on the user's role.
 */
export function ProcurementBar({ productId, productBrand, isVendorOwner = false }: ProcurementBarProps) {
  const { role } = useRole();
  const { data: session } = useSession();
  const router = useRouter();

  const isGuest = !session?.user;
  const effectiveRole = isGuest ? null : role;
  const ctas = getCTAsForRole(effectiveRole, isVendorOwner);

  const handleAction = async (action: string) => {
    // Log atelier signal
    try {
      await fetch("/api/analytics/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action.toLowerCase(),
          payload: { productId, source: "sticky_bar" },
        }),
      }).catch(() => {}); // Fire and forget
    } catch {}

    // Route actions
    switch (action) {
      case "PROCUREMENT_QUOTE_REQUEST":
        // TODO: Wire to quote request flow
        break;
      case "PROCUREMENT_REP_CONTACT":
        // TODO: Wire to contact rep flow
        break;
      case "VENDOR_VIEW_SPECIFIERS":
        // TODO: Wire to vendor specifiers view
        break;
      case "VENDOR_BOOST_INITIATE":
        // TODO: Wire to boost flow
        break;
      case "INDIVIDUAL_FIND_DESIGNER":
        router.push("/designers");
        break;
      case "SAVE_PRODUCT":
        // TODO: Wire to save modal
        break;
      case "GUEST_SIGNUP":
        router.push("/auth/signin?callbackUrl=" + encodeURIComponent(window.location.pathname));
        break;
      case "GUEST_LEARN_MORE":
        router.push("/about");
        break;
    }
  };

  return (
    <div
      className="sticky bottom-0 z-10 flex gap-2"
      style={{
        padding: "1rem 1.5rem",
        background: "var(--surface-canvas, #ffffff)",
        borderTop: "0.5px solid var(--folio-border-subtle, #e8e4df)",
      }}
    >
      <button
        onClick={() => handleAction(ctas.primary.action)}
        className="flex-1 font-body cursor-pointer"
        style={{
          padding: "10px",
          borderRadius: "8px",
          background: "#3a2a1a",
          color: "#f5efe8",
          fontSize: 'var(--type-meta)',
          fontWeight: 'var(--w-h1)',
          textAlign: "center",
          border: "none",
        }}
      >
        {ctas.primary.label}
      </button>
      <button
        onClick={() => handleAction(ctas.secondary.action)}
        className="flex-1 font-body cursor-pointer"
        style={{
          padding: "10px",
          borderRadius: "8px",
          background: "transparent",
          color: "#3a2a1a",
          fontSize: 'var(--type-meta)',
          fontWeight: 'var(--w-h1)',
          textAlign: "center",
          border: "0.5px solid var(--folio-border-strong, #d4cfc8)",
        }}
      >
        {ctas.secondary.label}
      </button>
    </div>
  );
}
