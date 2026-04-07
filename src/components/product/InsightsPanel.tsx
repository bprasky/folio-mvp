"use client";

import React from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { VendorInsightsMini } from "./VendorInsightsMini";
import { Product } from "@/lib/mock/product";

interface InsightsPanelProps {
  product: Product;
}

export function InsightsPanel({ product }: InsightsPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <GlassPanel
        header={
          <h2 className="text-lg font-medium text-folio-text-primary dark:text-folio-text-tertiary">
            Product Insights
          </h2>
        }
      >
        <VendorInsightsMini product={product} />
      </GlassPanel>
    </motion.div>
  );
}




