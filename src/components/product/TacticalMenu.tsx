"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderPlus, FileDown, Box, ShoppingCart, Plus } from "lucide-react";
import { Product } from "@/lib/mock/product";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { toast } from "sonner";

interface TacticalMenuProps {
  product: Product;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  /** Called when user clicks "Add to Project" — parent handles the modal */
  onAddToProject?: () => void;
  /** HUD opacity — trigger fades with other HUD elements */
  hudOpacity?: number;
}

// Radial menu item positions — clockwise from 12:00 (fanning right, away from product)
// Trigger sits to the right of the product; items arc outward to not obscure it
const RADIAL_RADIUS = 72;
const RADIAL_POSITIONS = [
  { x: 0, y: -RADIAL_RADIUS },                                    // 12:00 — straight up
  { x: RADIAL_RADIUS * 0.71, y: -RADIAL_RADIUS * 0.71 },         // 1:30 — upper-right
  { x: RADIAL_RADIUS, y: 0 },                                     // 3:00 — right
  { x: RADIAL_RADIUS * 0.71, y: RADIAL_RADIUS * 0.71 },          // 4:30 — lower-right
];

const MENU_ITEMS = [
  { id: "add-to-project", label: "Add to Project", Icon: FolderPlus, accent: false },
  { id: "download-3d", label: "Download 3D", Icon: Box, accent: false },
  { id: "download-spec", label: "Download Spec", Icon: FileDown, accent: false },
  { id: "order-sample", label: "Order Sample", Icon: ShoppingCart, accent: true },
] as const;

export function TacticalMenu({
  product,
  isOpen,
  onToggle,
  onClose,
  onAddToProject,
  hudOpacity = 1,
}: TacticalMenuProps) {
  const [sampleLoading, setSampleLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        setFocusedIndex(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Keyboard navigation when open
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => (i + 1) % MENU_ITEMS.length);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => (i - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
      } else if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        handleAction(MENU_ITEMS[focusedIndex].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, focusedIndex]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid catching the open click
    const timer = setTimeout(() => {
      window.addEventListener("click", onClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", onClick);
    };
  }, [isOpen, onClose]);

  const handleAction = useCallback(
    (id: string) => {
      switch (id) {
        case "add-to-project":
          onAddToProject?.();
          break;
        case "download-3d":
          if (!product.mesh3dUrl) return;
          const link = document.createElement("a");
          link.href = product.mesh3dUrl;
          link.download = `${product.name.replace(/[^a-zA-Z0-9]/g, "_")}.glb`;
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.success("3D file download started");
          break;
        case "download-spec":
          window.open(`/api/products/${product.id}/spec-sheet`, "_blank");
          break;
        case "order-sample":
          handleOrderSample();
          break;
      }
      onClose();
      setFocusedIndex(-1);
    },
    [product, onAddToProject, onClose]
  );

  const handleOrderSample = async () => {
    setSampleLoading(true);
    try {
      const res = await fetch(`/api/products/${product.id}/request-sample`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 401) {
        window.location.href =
          "/auth/signin?callbackUrl=" +
          encodeURIComponent(window.location.pathname);
        return;
      }

      const data = await res.json();

      if (data.status === "NO_REP") {
        toast.info(
          data.vendorOrgName
            ? `No rep found for ${data.vendorOrgName}. Connect your vendor accounts to request samples.`
            : "Connect your vendor accounts to auto-log sampling"
        );
      } else if (data.status === "SENT") {
        toast.success(
          `Sample request sent${data.repName ? ` to ${data.repName}` : ""}${product.brand ? ` at ${product.brand}` : ""}`
        );
      } else if (data.error) {
        toast.error(data.error);
      }
    } catch {
      toast.error("Failed to send sample request");
    } finally {
      setSampleLoading(false);
    }
  };

  const has3D = !!product.mesh3dUrl;

  return (
    <div ref={menuRef} className="z-30 relative">
      {/* Trigger Button — ⊕ with glass styling */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center rounded-full transition-all backdrop-blur-xl"
        style={{
          width: isMobile ? 56 : 44,
          height: isMobile ? 56 : 44,
          backgroundColor: isOpen ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.35)",
          boxShadow: "0 2px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255,255,255,0.4)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          opacity: isOpen ? 1 : hudOpacity * 0.6 + 0.4,
          transition: "opacity 300ms ease-out, background-color 200ms ease",
        }}
        aria-label={isOpen ? "Close actions menu" : "Open actions menu"}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Plus className="w-5 h-5 text-stone-500" />
        </motion.div>
      </button>

      {/* Desktop: Radial Menu — clockwise from 12:00 */}
      {!isMobile && (
        <AnimatePresence>
          {isOpen && (
            <div
              className="absolute"
              role="menu"
              style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            >
              {MENU_ITEMS.map((item, index) => {
                const pos = RADIAL_POSITIONS[index];
                const isDisabled = item.id === "download-3d" && !has3D;
                const isFocused = focusedIndex === index;

                return (
                  <motion.button
                    key={item.id}
                    role="menuitem"
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
                    animate={{
                      opacity: isDisabled ? 0.4 : 1,
                      x: pos.x,
                      y: pos.y,
                      scale: 1,
                    }}
                    exit={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.05,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                    onClick={() => !isDisabled && handleAction(item.id)}
                    disabled={isDisabled}
                    className={`absolute flex items-center justify-center rounded-full group backdrop-blur-xl ${
                      isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                    style={{
                      width: 42,
                      height: 42,
                      marginLeft: -21,
                      marginTop: -21,
                      backgroundColor: item.accent
                        ? "rgba(201, 169, 110, 0.9)"
                        : "rgba(255, 255, 255, 0.45)",
                      boxShadow: "0 2px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255,255,255,0.4)",
                      border: item.accent
                        ? "1px solid rgba(201, 169, 110, 0.6)"
                        : "1px solid rgba(255, 255, 255, 0.35)",
                      outline: isFocused ? "2px solid #c9a96e" : "none",
                      outlineOffset: 2,
                    }}
                    aria-label={item.label}
                  >
                    <item.Icon
                      className={`w-4 h-4 ${item.accent ? "text-white" : "text-stone-600"}`}
                    />
                    {/* Hover label */}
                    <span
                      className="absolute whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
                      style={{
                        bottom: "calc(100% + 8px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "rgba(28, 25, 23, 0.75)",
                        color: "white",
                      }}
                    >
                      {item.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      )}

      {/* Mobile: Bottom Sheet */}
      {isMobile && (
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                onClick={onClose}
              />

              {/* Sheet */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed bottom-0 inset-x-0 z-50 rounded-t-2xl"
                style={{ backgroundColor: "rgba(255, 252, 247, 0.95)" }}
                role="menu"
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 rounded-full bg-stone-300" />
                </div>

                <div className="px-4 pb-8 pt-2 space-y-1">
                  {MENU_ITEMS.map((item) => {
                    const isDisabled = item.id === "download-3d" && !has3D;
                    return (
                      <button
                        key={item.id}
                        role="menuitem"
                        onClick={() => !isDisabled && handleAction(item.id)}
                        disabled={isDisabled}
                        className={`w-full flex items-center gap-3 px-4 rounded-xl transition-colors ${
                          isDisabled
                            ? "text-stone-400 cursor-not-allowed"
                            : "text-stone-800 active:bg-stone-100"
                        }`}
                        style={{ height: 56 }}
                      >
                        <div
                          className="flex items-center justify-center rounded-full flex-shrink-0"
                          style={{
                            width: 36,
                            height: 36,
                            backgroundColor: item.accent
                              ? "#c9a96e"
                              : "rgba(0, 0, 0, 0.05)",
                          }}
                        >
                          <item.Icon
                            className={`w-4 h-4 ${item.accent ? "text-white" : isDisabled ? "text-stone-400" : "text-stone-600"}`}
                          />
                        </div>
                        <span className="text-sm font-medium">{item.label}</span>
                        {item.accent && (
                          <span
                            className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "#c9a96e20", color: "#c9a96e" }}
                          >
                            Primary
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

    </div>
  );
}
