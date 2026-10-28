"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { projectEntryHref } from "@/lib/onboarding/professional-entry";
import { useSession } from "next-auth/react";
import { Plus, ChevronDown, FileText, Package, FolderPlus } from "lucide-react";
import { normalizeRole } from "@/lib/permissions";
import { CreateCollaborationModal } from "@/components/collaboration/CreateCollaborationModal";
import type { NavigationWorkspace } from "./useNavigationWorkspace";

export function CreateButton({ workspace }: { workspace: NavigationWorkspace | null }) {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [showCollaborationModal, setShowCollaborationModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status !== "authenticated" || workspace?.user.id !== session?.user?.id || !workspace?.organizations.length) {
    return null;
  }

  const role = normalizeRole(session?.user?.role);
  const orgType = workspace.operatingAsOrg?.type;
  const isVendor = orgType ? ["VENDOR", "MANUFACTURER", "SHOWROOM"].includes(orgType) : role === "VENDOR";

  // For vendors, show dropdown with multiple options
  if (isVendor) {
    return (
      <>
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 folio-ui text-surface-canvas bg-folio-text-primary rounded-full hover:opacity-90 transition-colors"
            aria-label="Create menu"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <div className="absolute left-0 mt-2 w-56 rounded-xl border border-folio-border-subtle bg-surface-canvas shadow-lg py-2 z-50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowCollaborationModal(true);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 folio-ui text-folio-text-primary hover:bg-surface-ground transition-colors"
              >
                <FileText className="h-4 w-4 text-folio-text-secondary" />
                <div className="text-left">
                  <span className="block">Collaboration Story</span>
                  <span className="text-xs text-folio-text-secondary">Invite a designer</span>
                </div>
              </button>

              <Link
                href="/vendor/products/new"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 folio-ui text-folio-text-primary hover:bg-surface-ground transition-colors"
              >
                <Package className="h-4 w-4 text-folio-text-secondary" />
                <div className="text-left">
                  <span className="block">Add Product</span>
                  <span className="text-xs text-folio-text-secondary">Import from URL</span>
                </div>
              </Link>

              <Link
                href="/vendor/create-project"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 folio-ui text-folio-text-primary hover:bg-surface-ground transition-colors"
              >
                <FolderPlus className="h-4 w-4 text-folio-text-secondary" />
                <div className="text-left">
                  <span className="block">Project Handoff</span>
                  <span className="text-xs text-folio-text-secondary">Create for a designer</span>
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Collaboration Modal */}
        <CreateCollaborationModal
          open={showCollaborationModal}
          onOpenChange={setShowCollaborationModal}
        />
      </>
    );
  }

  // Personal workspace members choose a firm through the existing enrollment flow.
  return (
    <Link
      href={projectEntryHref({ operatingAsOrgId: workspace.operatingAsOrgId })}
      className="flex items-center gap-1.5 px-3 py-1.5 folio-ui text-surface-canvas bg-folio-text-primary rounded-full hover:opacity-90 transition-colors"
    >
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">Create</span>
    </Link>
  );
}
