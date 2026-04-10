"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface VendorInsights {
  saves: number;
  tags: number;
  saveToTagPct: number;
  topRooms: { label: string; pct: number }[];
  topMarkets: { city: string; pct: number }[];
}

interface VendorIntelligenceProps {
  productId: string;
}

/**
 * Vendor Intelligence panel — only rendered for vendor owners and admins.
 * The role gate is enforced at the parent level (server-side).
 * This component fetches real metrics from the API.
 */
export function VendorIntelligence({ productId }: VendorIntelligenceProps) {
  const [insights, setInsights] = useState<VendorInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch(`/api/products/${productId}/vendor-insights`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setInsights(data);
      } catch {
        console.error("Failed to fetch vendor insights");
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, [productId]);

  if (loading || !insights) return null;

  const { saves, tags, saveToTagPct, topRooms, topMarkets } = insights;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: [0.25, 0.8, 0.25, 1] }}
      className="relative rounded-xl"
      style={{
        background: "rgba(245, 239, 232, 0.6)",
        border: "0.5px solid var(--folio-border-subtle, #e8e4df)",
        padding: "1.5rem",
      }}
    >
      {/* Badge */}
      <div
        className="absolute font-body"
        style={{
          top: "-8px",
          right: "16px",
          background: "#3a2a1a",
          color: "#c9a96e",
          fontSize: "9px",
          fontWeight: 500,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          padding: "3px 10px",
          borderRadius: "4px",
        }}
      >
        Vendor Intelligence
      </div>

      {/* 3-column stat grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Saves" value={saves} />
        <StatCard label="Tags" value={tags} />
        <StatCard label="Save→Tag" value={`${saveToTagPct}%`} />
      </div>

      {/* Mini bar charts */}
      <div className="grid grid-cols-2 gap-6">
        {topRooms.length > 0 && (
          <MiniBarChart label="Top Rooms" items={topRooms.slice(0, 3).map(r => ({ label: r.label, pct: r.pct }))} />
        )}
        {topMarkets.length > 0 && (
          <MiniBarChart label="Top Markets" items={topMarkets.slice(0, 3).map(m => ({ label: m.city, pct: m.pct }))} />
        )}
      </div>
    </motion.section>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: "rgba(255, 255, 255, 0.5)" }}
    >
      <div
        className="font-body"
        style={{
          fontSize: "10px",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "1px",
          color: "var(--folio-text-tertiary, #9b9b9b)",
        }}
      >
        {label}
      </div>
      <div
        className="font-body mt-1"
        style={{
          fontSize: "22px",
          fontWeight: 500,
          color: "var(--folio-text-primary, #1a1a1a)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniBarChart({ label, items }: { label: string; items: { label: string; pct: number }[] }) {
  const maxPct = Math.max(...items.map(i => i.pct), 1);

  return (
    <div>
      <div
        className="font-body mb-3"
        style={{
          fontSize: "10px",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "1px",
          color: "var(--folio-text-tertiary, #9b9b9b)",
        }}
      >
        {label}
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span
                className="font-body"
                style={{ fontSize: "12px", color: "var(--folio-text-secondary, #6b6b6b)" }}
              >
                {item.label}
              </span>
              <span
                className="font-body"
                style={{ fontSize: "11px", color: "var(--folio-text-tertiary, #9b9b9b)" }}
              >
                {item.pct}%
              </span>
            </div>
            <div
              className="rounded-sm"
              style={{
                height: "4px",
                background: "var(--folio-border-subtle, #e8e4df)",
                borderRadius: "2px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(item.pct / maxPct) * 100}%`,
                  borderRadius: "2px",
                  background: "#c9a96e",
                  transition: "width 0.6s ease-out",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
