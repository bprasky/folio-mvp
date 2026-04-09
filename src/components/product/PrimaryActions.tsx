"use client";

import { useState } from "react";
import { Product } from "@/lib/mock/product";
import { Button } from "@/components/ui/button";
import { ShoppingCart, FolderPlus, FileDown, Box } from "lucide-react";
import { useSaveToProjectFolder } from "@/components/projects/useSaveToProjectFolder";
import dynamic from "next/dynamic";
import { toast } from "sonner";

const SaveToFolderModal = dynamic(
  () => import("@/components/projects/SaveToFolderModal"),
  { ssr: false }
);

export function PrimaryActions({ product }: { product: Product }) {
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
        window.location.href = "/auth/signin?callbackUrl=" + encodeURIComponent(window.location.pathname);
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
    <div className="space-y-3">
      {/* Primary Action - Visually Dominant */}
      <Button
        onClick={handleOrderSample}
        disabled={sampleLoading}
        className="w-full bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-stone-200 text-white dark:text-stone-900 py-3"
        size="lg"
      >
        <ShoppingCart className="w-4 h-4 mr-2" />
        {sampleLoading ? "Requesting..." : "Order Sample"}
      </Button>

      {/* Secondary Actions */}
      <div className="flex flex-col gap-2 pt-2">
        <Button
          onClick={handleSaveToProject}
          variant="ghost"
          className="w-full justify-start text-stone-700 dark:text-stone-300 hover:bg-white/10 dark:hover:bg-white/5"
          size="sm"
        >
          <FolderPlus className="w-3.5 h-3.5 mr-2" />
          Add to Project
        </Button>
        <Button
          onClick={handleDownloadSpec}
          variant="ghost"
          className="w-full justify-start text-stone-700 dark:text-stone-300 hover:bg-white/10 dark:hover:bg-white/5"
          size="sm"
        >
          <FileDown className="w-3.5 h-3.5 mr-2" />
          Download Spec
        </Button>
        <Button
          onClick={handleDownload3D}
          disabled={!has3D}
          variant="ghost"
          className={`w-full justify-start ${
            has3D
              ? "text-stone-700 dark:text-stone-300 hover:bg-white/10 dark:hover:bg-white/5"
              : "text-stone-400 dark:text-stone-600 cursor-not-allowed"
          }`}
          size="sm"
        >
          <Box className="w-3.5 h-3.5 mr-2" />
          Download 3D
        </Button>
      </div>

      <div className="text-xs text-stone-500/80 dark:text-stone-400/80 pt-3 border-t border-white/10 dark:border-white/5 leading-relaxed">
        💡 Connect your vendor accounts to auto-log sampling
      </div>

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
