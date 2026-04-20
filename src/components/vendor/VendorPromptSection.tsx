"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Prompt {
  id: string;
  title: string;
  question: string;
  category: string;
  status: string;
  relatedDesignerName?: string;
  relatedProductName?: string;
}

interface VendorPromptSectionProps {
  orgId: string;
  isOwner: boolean; // Only owners/admins can answer prompts
}

/**
 * Curated editorial prompts for vendor content creation.
 * Shows on the public org page (as activity indicator) and in the dashboard (for answering).
 * Vendors answer questions → AI generates article → published to feed.
 */
export function VendorPromptSection({ orgId, isOwner }: VendorPromptSectionProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/prompts`)
      .then(r => r.json())
      .then(data => setPrompts(data.prompts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  const handleSubmitAnswer = async (promptId: string) => {
    if (!answer.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/prompts/${promptId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Article generated! Check your feed.");
      setAnswer("");
      setActivePrompt(null);
      // Refresh prompts
      const refreshed = await fetch(`/api/orgs/${orgId}/prompts`).then(r => r.json());
      setPrompts(refreshed.prompts || []);
    } catch {
      toast.error("Failed to generate article. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return null;

  const activePrompts = prompts.filter(p => p.status === "ACTIVE");
  if (activePrompts.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full" style={{ background: "#c9a96e" }} />
        <h3 className="font-body font-medium" style={{ fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase", color: "var(--folio-text-tertiary)" }}>
          Content Prompts
        </h3>
      </div>

      <div className="space-y-2.5">
        {activePrompts.slice(0, 3).map(prompt => (
          <div key={prompt.id}>
            <button
              onClick={() => isOwner && setActivePrompt(activePrompt === prompt.id ? null : prompt.id)}
              className={`w-full text-left rounded-xl px-4 py-3 transition-colors ${isOwner ? 'cursor-pointer hover:bg-[rgba(245,239,232,0.8)]' : 'cursor-default'}`}
              style={{ background: "rgba(245, 239, 232, 0.5)", border: "0.5px solid var(--folio-border-subtle)" }}
            >
              <div className="font-body font-medium" style={{ fontSize: "13px", color: "var(--folio-text-primary)" }}>
                {prompt.title}
              </div>
              <div className="font-body mt-0.5" style={{ fontSize: "12px", color: "var(--folio-text-secondary)" }}>
                {prompt.question}
              </div>
              {prompt.relatedDesignerName && (
                <div className="font-body mt-1" style={{ fontSize: "10px", color: "#c9a96e" }}>
                  Inspired by {prompt.relatedDesignerName}'s project
                </div>
              )}
            </button>

            {/* Answer form (owner only) */}
            <AnimatePresence>
              {activePrompt === prompt.id && isOwner && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-3">
                    <textarea
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      placeholder="Share your thoughts... Folio will craft an article from your response."
                      rows={4}
                      className="w-full font-body rounded-lg px-3.5 py-2.5 resize-y mb-2"
                      style={{ fontSize: "13px", background: "rgba(245,239,232,0.5)", border: "0.5px solid var(--folio-border-subtle)", color: "var(--folio-text-primary)", outline: "none" }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSubmitAnswer(prompt.id)}
                        disabled={generating || !answer.trim()}
                        className="font-body px-4 py-2 rounded-lg cursor-pointer"
                        style={{ fontSize: "12px", fontWeight: 500, background: "#3a2a1a", color: "#f5efe8", border: "none", opacity: generating ? 0.5 : 1 }}
                      >
                        {generating ? "Generating article..." : "Generate Article"}
                      </button>
                      <button
                        onClick={() => { setActivePrompt(null); setAnswer(""); }}
                        className="font-body px-4 py-2 rounded-lg cursor-pointer"
                        style={{ fontSize: "12px", color: "var(--folio-text-secondary)", background: "transparent", border: "none" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
