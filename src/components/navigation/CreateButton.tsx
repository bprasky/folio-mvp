"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, ChevronDown, FileText, Package, FolderPlus } from "lucide-react";
import { normalizeRole } from "@/lib/permissions";
import { CreateCollaborationModal } from "@/components/collaboration/CreateCollaborationModal";

export function CreateButton() {
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

  // Don't show if not authenticated or loading
  if (status === "loading" || !session?.user) {
    return null;
  }

  const role = normalizeRole(session.user.role);
  const isVendor = role === "VENDOR";

  // For vendors, show dropdown with multiple options
  if (isVendor) {
    return (
      <>
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 folio-ui text-[var(--bg-base)] bg-[var(--text-primary)] rounded-full hover:opacity-90 transition-colors"
            aria-label="Create menu"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--ridge-outer)] bg-[var(--bg-base)] shadow-lg py-2 z-50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowCollaborationModal(true);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 folio-ui text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <FileText className="h-4 w-4 text-[var(--text-secondary)]" />
                <div className="text-left">
                  <span className="block">Collaboration Story</span>
                  <span className="text-xs text-[var(--text-secondary)]">Invite a designer</span>
                </div>
              </button>

              <Link
                href="/vendor/products/new"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 folio-ui text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <Package className="h-4 w-4 text-[var(--text-secondary)]" />
                <div className="text-left">
                  <span className="block">Add Product</span>
                  <span className="text-xs text-[var(--text-secondary)]">Import from URL</span>
                </div>
              </Link>

              <Link
                href="/vendor/create-project"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 folio-ui text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <FolderPlus className="h-4 w-4 text-[var(--text-secondary)]" />
                <div className="text-left">
                  <span className="block">Project Handoff</span>
                  <span className="text-xs text-[var(--text-secondary)]">Create for a designer</span>
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

  // For individuals, designers, and other authenticated users - simple create project button
  return (
    <Link
      href="/projects/new"
      className="flex items-center gap-1.5 px-3 py-1.5 folio-ui text-[var(--bg-base)] bg-[var(--text-primary)] rounded-full hover:opacity-90 transition-colors"
    >
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">Create</span>
    </Link>
  );
}
