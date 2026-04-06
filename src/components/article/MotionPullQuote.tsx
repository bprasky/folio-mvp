"use client";

import { motion } from "framer-motion";

export function MotionPullQuote({ text, context }: { text: string; context?: string }) {
  if (!text) return null;

  return (
    <motion.blockquote
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      transition={{ duration: 0.5 }}
      className="mt-8 rounded-2xl bg-surface-ground p-5 text-folio-text-primary ring-1 ring-black/5"
    >
      {context && (
        <span className="block text-xs uppercase tracking-wider text-folio-text-tertiary mb-2 not-italic">
          {context}
        </span>
      )}
      <span className="italic">&ldquo;{text}&rdquo;</span>
    </motion.blockquote>
  );
}
