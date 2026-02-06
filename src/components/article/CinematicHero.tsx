"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

type Props = {
  imageUrl: string;
  title?: string | null;
  deck?: string | null;
};

export default function CinematicHero({ imageUrl, title, deck }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.05]);

  return (
    <div ref={ref} className="relative">
      <motion.div
        style={{ y, scale }}
        className="overflow-hidden rounded-3xl ring-1 ring-black/5"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title || "Project hero"}
          className="w-full h-[520px] object-cover"
        />
      </motion.div>
      {/* light-bleed divider */}
      <div className="pointer-events-none h-8 w-full -mt-4 rounded-2xl bg-gradient-to-b from-[var(--bg-base)]/70 to-transparent" />
      {/* optional subhead slip-in on first scroll */}
      {deck ? (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-20% 0px -10% 0px" }}
          transition={{ duration: 0.5 }}
          className="mt-3 text-[15px] text-[var(--text-secondary)]"
        >
          {deck}
        </motion.p>
      ) : null}
    </div>
  );
}


