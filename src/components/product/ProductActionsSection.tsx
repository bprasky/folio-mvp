"use client";

import { useState } from "react";
import { Product } from "@/lib/mock/product";
import { ShoppingCart, FolderPlus, FileDown, Box } from "lucide-react";
import { useSaveToProjectFolder } from "@/components/projects/useSaveToProjectFolder";
import dynamic from "next/dynamic";
import { toast } from "sonner";

const SaveToFolderModal = dynamic(
  () => import("@/components/projects/SaveToFolderModal"),
  { ssr: false }
);

/**
 * Temporary horizontal actions row for the editorial section.
 * Will be replaced by the tactical radial menu in Phase 2.
 */
export function ProductActionsSection({ product }: { product: Product }) {
  const { openSaveDialog, modalProps } = useSaveToProjectFolder();
  const [sampleLoading, setSampleLoading] = useState(false);

  const handleSaveToProject = () => {
    openSaveDialog({ productId: product.id, source: "product_page" });
  };

  const handleDownload3D = () => {
    if (!product.mesh3dUrl) return;
    const link = document.createElement("a");
    link.href = product.mesh3dUrl;
    link.download = `${product.name.replace(/[^a-zA-Z0-9]/g, "_")}.glb`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("3D file download started");
  };

  const handleDownloadSpec = () => {
    window.open(`/api/products/${product.id}/spec-sheet`, "_blank");
  };

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
    <div className="flex flex-wrap items-center gap-3">
      {/* Primary: Order Sample — gold accent */}
      <button
        onClick={handleOrderSample}
        disabled={sampleLoading}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white transition-colors"
        style={{ backgroundColor: sampleLoading ? "#b8a060" : "#c9a96e" }}
      >
        <ShoppingCart className="w-4 h-4" />
        {sampleLoading ? "Requesting..." : "Order Sample"}
      </button>

      {/* Secondary actions */}
      <button
        onClick={handleSaveToProject}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-stone-700 bg-white/70 hover:bg-white/90 border border-stone-200 transition-colors"
      >
        <FolderPlus className="w-3.5 h-3.5" />
        Add to Project
      </button>

      <button
        onClick={handleDownloadSpec}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-stone-700 bg-white/70 hover:bg-white/90 border border-stone-200 transition-colors"
      >
        <FileDown className="w-3.5 h-3.5" />
        Download Spec
      </button>

      <button
        onClick={handleDownload3D}
        disabled={!has3D}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium border transition-colors ${
          has3D
            ? "text-stone-700 bg-white/70 hover:bg-white/90 border-stone-200"
            : "text-stone-400 bg-white/40 border-stone-100 cursor-not-allowed"
        }`}
      >
        <Box className="w-3.5 h-3.5" />
        Download 3D
      </button>

      {/* Save to Project Modal */}
      {modalProps.isOpen && modalProps.productId && (
        <SaveToFolderModal
          isOpen={modalProps.isOpen}
          onClose={modalProps.onClose}
          productId={modalProps.productId}
          eventId={modalProps.eventId}
          eventTitle={modalProps.eventTitle}
          onSuccess={modalProps.onSuccess}
        />
      )}
    </div>
  );
}
