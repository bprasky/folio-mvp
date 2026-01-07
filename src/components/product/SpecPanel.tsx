"use client";

import React from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { CollapsibleSection } from "./CollapsibleSection";
import { Product } from "@/lib/mock/product";

interface SpecPanelProps {
  product: Product;
}

export function SpecPanel({ product }: SpecPanelProps) {
  const { dimensions, weight, materials, finish, leadTime } = product;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
    >
      <GlassPanel
        header={
          <h2 className="text-lg font-medium text-stone-900 dark:text-stone-100">
            Specifications
          </h2>
        }
      >
        <div className="space-y-0">
          <CollapsibleSection title="Dimensions" defaultOpen>
            <div className="grid grid-cols-2 gap-4">
              <SpecItem 
                label="Size" 
                value={`${dimensions.w}" × ${dimensions.d}" × ${dimensions.h}" ${dimensions.units === "in" ? "(W × D × H)" : ""}`} 
              />
              {weight && (
                <SpecItem 
                  label="Weight" 
                  value={`${weight.value} ${weight.units}`} 
                />
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Materials & Finish" defaultOpen>
            <div className="grid grid-cols-2 gap-4">
              <SpecItem label="Materials" value={materials.join(", ")} />
              <SpecItem label="Finish" value={finish} />
            </div>
          </CollapsibleSection>

          {leadTime && (
            <CollapsibleSection title="Availability">
              <SpecItem label="Lead Time" value={leadTime} />
              <SpecItem label="SKU" value={product.sku} />
            </CollapsibleSection>
          )}
        </div>
      </GlassPanel>
    </motion.div>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-sm text-stone-900 dark:text-stone-100">
        {value}
      </div>
    </div>
  );
}




