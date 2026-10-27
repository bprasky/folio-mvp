"use client";

import React, { useState } from "react";
import Image from '@/components/FolioImage';
import Link from "next/link";
import { toast } from "sonner";

interface BoostItem {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  product: {
    id: string;
    name: string;
    brand: string | null;
    imageUrl: string | null;
  };
  projectImage: string | null;
  room: string | null;
  projectTitle: string;
  articleSlug: string | null;
  designer: {
    id: string;
    name: string;
    profileImage: string | null;
  };
  followUpQuestion: string | null;
  followUpAnswer: string | null;
  impressions: number;
  clicks: number;
  designerPayoutCents: number;
  vendorSpendCents: number;
  accuracyConfirmed: boolean;
}

interface InContextBoostDashboardProps {
  boosts: BoostItem[];
  isAdmin: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_REVIEW: { label: "Pending Review", color: "#BA7517", bg: "rgba(186, 117, 23, 0.1)" },
  NOTIFIED: { label: "Awaiting Review", color: "#BA7517", bg: "rgba(186, 117, 23, 0.1)" },
  VIEWED: { label: "Viewed", color: "#4a7c59", bg: "rgba(74, 124, 89, 0.1)" },
  APPROVED: { label: "Active", color: "#639922", bg: "rgba(99, 153, 34, 0.1)" },
  DECLINED: { label: "Declined", color: "#A32D2D", bg: "rgba(163, 45, 45, 0.1)" },
  EXPIRED: { label: "Expired", color: "#9b9b9b", bg: "rgba(155, 155, 155, 0.1)" },
};

export function InContextBoostDashboard({ boosts, isAdmin }: InContextBoostDashboardProps) {
  const [filter, setFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = filter === "all"
    ? boosts
    : boosts.filter((b) => b.status === filter);

  const pendingCount = boosts.filter((b) => ["PENDING_REVIEW", "NOTIFIED", "VIEWED"].includes(b.status)).length;
  const activeCount = boosts.filter((b) => b.status === "APPROVED").length;

  const handleAction = async (boostId: string, action: "approve" | "decline", productId: string) => {
    setActionLoading(boostId);
    try {
      const res = await fetch(`/api/products/${productId}/in-context-boosts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          boostId,
          followUpQuestion: action === "approve" ? "What made you choose this product for this project?" : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(action === "approve" ? "Boost approved! Designer will be notified." : "Boost declined.");
      // Reload to reflect changes
      window.location.reload();
    } catch {
      toast.error("Failed to process action");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1
          className="font-headline font-light"
          style={{ fontSize: "clamp(24px, 3vw, 36px)", color: "var(--folio-text-primary, #1a1a1a)" }}
        >
          In Context Boosts
        </h1>
        <p
          className="font-body mt-2"
          style={{ fontSize: 'var(--type-ui)', color: "var(--folio-text-secondary, #6b6b6b)" }}
        >
          When designers feature your products in their projects, review and boost to earn placement on your product pages.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Pending" value={pendingCount} color="#BA7517" />
        <StatCard label="Active" value={activeCount} color="#639922" />
        <StatCard label="Total" value={boosts.length} color="var(--folio-text-primary, #1a1a1a)" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { key: "all", label: "All" },
          { key: "PENDING_REVIEW", label: "Pending" },
          { key: "APPROVED", label: "Active" },
          { key: "DECLINED", label: "Declined" },
          { key: "EXPIRED", label: "Expired" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="font-body px-3 py-1.5 rounded-full cursor-pointer transition-colors"
            style={{
              fontSize: 'var(--type-meta)',
              fontWeight: 'var(--w-h1)',
              background: filter === tab.key ? "#3a2a1a" : "rgba(245, 239, 232, 0.6)",
              color: filter === tab.key ? "#f5efe8" : "var(--folio-text-secondary, #6b6b6b)",
              border: "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Boost list */}
      {filtered.length === 0 ? (
        <div
          className="text-center py-16 font-body"
          style={{ color: "var(--folio-text-tertiary, #9b9b9b)", fontSize: 'var(--type-ui)' }}
        >
          No boost opportunities {filter !== "all" ? "with this status" : "yet"}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((boost) => (
            <BoostCard
              key={boost.id}
              boost={boost}
              onApprove={() => handleAction(boost.id, "approve", boost.product.id)}
              onDecline={() => handleAction(boost.id, "decline", boost.product.id)}
              isLoading={actionLoading === boost.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-lg px-3.5 py-3"
      style={{ background: "rgba(245, 239, 232, 0.6)" }}
    >
      <div
        className="font-body"
        style={{ fontSize: 'var(--type-fine)', letterSpacing: "1px", textTransform: "uppercase", color: "var(--folio-text-tertiary, #9b9b9b)" }} /* folio-design-system: off-scale */
      >
        {label}
      </div>
      <div className="font-body mt-1" style={{ fontSize: 'var(--type-h4)', fontWeight: 'var(--w-h1)', color }}>
        {value}
      </div>
    </div>
  );
}

function BoostCard({
  boost,
  onApprove,
  onDecline,
  isLoading,
}: {
  boost: BoostItem;
  onApprove: () => void;
  onDecline: () => void;
  isLoading: boolean;
}) {
  const statusConfig = STATUS_CONFIG[boost.status] || STATUS_CONFIG.PENDING_REVIEW;
  const isPending = ["PENDING_REVIEW", "NOTIFIED", "VIEWED"].includes(boost.status);
  const isActive = boost.status === "APPROVED";

  return (
    <div
      className="rounded-xl p-4 flex gap-4"
      style={{
        background: "rgba(245, 239, 232, 0.4)",
        border: "0.5px solid var(--folio-border-subtle, #e8e4df)",
      }}
    >
      {/* Project image thumbnail */}
      {boost.projectImage && (
        <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={boost.projectImage}
            alt={boost.projectTitle}
            fill
            className="object-cover"
            sizes="80px"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <div className="font-body font-medium" style={{ fontSize: 'var(--type-ui)', color: "var(--folio-text-primary)" }}>
              {boost.product.name}
            </div>
            <div className="font-body" style={{ fontSize: 'var(--type-meta)', color: "var(--folio-text-secondary)" }}>
              {boost.projectTitle} · by {boost.designer.name}
            </div>
          </div>
          {/* Status badge */}
          <span
            className="font-body flex-shrink-0 px-2 py-0.5 rounded-full"
            style={{
              fontSize: 'var(--type-fine)',
              fontWeight: 'var(--w-h1)',
              color: statusConfig.color,
              background: statusConfig.bg,
            }}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Metrics (for active boosts) */}
        {isActive && (
          <div className="flex gap-4 mt-2 font-body" style={{ fontSize: 'var(--type-eyebrow)', color: "var(--folio-text-tertiary)" }}>
            <span>{boost.impressions.toLocaleString()} impressions</span>
            <span>{boost.clicks.toLocaleString()} clicks</span>
            {boost.vendorSpendCents > 0 && (
              <span>${(boost.vendorSpendCents / 100).toFixed(2)} spent</span>
            )}
          </div>
        )}

        {/* Follow-up Q&A (for active boosts) */}
        {isActive && boost.followUpAnswer && (
          <div
            className="mt-2 rounded-lg px-3 py-2 font-body"
            style={{ background: "rgba(201, 169, 110, 0.08)", fontSize: 'var(--type-meta)' }}
          >
            <span style={{ color: "var(--folio-text-tertiary)" }}>Q: </span>
            <span style={{ color: "var(--folio-text-secondary)" }}>{boost.followUpQuestion}</span>
            <br />
            <span style={{ color: "var(--folio-gold-ornament)" }}>A: </span>
            <span className="italic" style={{ color: "var(--folio-text-primary)" }}>{boost.followUpAnswer}</span>
          </div>
        )}

        {/* Actions (for pending boosts) */}
        {isPending && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={onApprove}
              disabled={isLoading}
              className="font-body px-4 py-1.5 rounded-lg cursor-pointer"
              style={{
                fontSize: 'var(--type-meta)',
                fontWeight: 'var(--w-h1)',
                background: "#3a2a1a",
                color: "#f5efe8",
                border: "none",
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? "..." : "Approve & Boost"}
            </button>
            <button
              onClick={onDecline}
              disabled={isLoading}
              className="font-body px-4 py-1.5 rounded-lg cursor-pointer"
              style={{
                fontSize: 'var(--type-meta)',
                fontWeight: 'var(--w-h1)',
                background: "transparent",
                color: "var(--folio-text-secondary)",
                border: "0.5px solid var(--folio-border-strong, #d4cfc8)",
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              Decline
            </button>
            {boost.articleSlug && (
              <Link
                href={`/p/${boost.articleSlug}`}
                className="font-body px-3 py-1.5 rounded-lg"
                style={{
                  fontSize: 'var(--type-meta)',
                  fontWeight: 'var(--w-h1)',
                  color: "#8a7044",
                }}
              >
                View article →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
