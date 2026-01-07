"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Unified hook for saving products to project folders.
 * Used by both:
 * - Image tag dots on published projects
 * - Featured products from Events
 * 
 * This ensures both flows use the same folder loading and saving logic.
 */
export function useSaveToProjectFolder() {
  const { data: session } = useSession();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const [eventTitle, setEventTitle] = useState<string | undefined>(undefined);

  const openSaveDialog = (opts: {
    productId: string;
    source?: string;
    eventId?: string;
    eventTitle?: string;
  }) => {
    if (!session?.user?.id) {
      // Redirect to sign in
      if (typeof window !== "undefined") {
        window.location.href =
          "/auth/signin?callbackUrl=" + encodeURIComponent(window.location.pathname);
      }
      return;
    }

    setSelectedProductId(opts.productId);
    setEventId(opts.eventId);
    setEventTitle(opts.eventTitle);
    setSaveModalOpen(true);
  };

  const closeModal = () => {
    setSaveModalOpen(false);
    setSelectedProductId(null);
    setEventId(undefined);
    setEventTitle(undefined);
  };

  return {
    openSaveDialog,
    modalProps: {
      isOpen: saveModalOpen,
      onClose: closeModal,
      productId: selectedProductId,
      eventId,
      eventTitle,
      onSuccess: (folderId: string) => {
        closeModal();
      },
    },
  };
}

