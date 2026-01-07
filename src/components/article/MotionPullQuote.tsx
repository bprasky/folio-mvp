"use client";

import { motion } from "framer-motion";

export function MotionPullQuote({ text }: { text: string }) {
  if (!text) return null;

  return (
    <motion.blockquote
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      transition={{ duration: 0.5 }}
      className="mt-8 rounded-2xl bg-neutral-50 p-5 italic text-neutral-700 ring-1 ring-black/5"
    >
      "{text}"
    </motion.blockquote>
  );
}


