"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PrimaryActions } from "./PrimaryActions";
import { Product } from "@/lib/mock/product";
import { ChevronUp, ChevronDown } from "lucide-react";

interface ActionDockProps {
  product: Product;
}

export function ActionDock({ product }: ActionDockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Desktop: Fixed Right Rail */}
      <aside 
        className="hidden lg:block fixed top-24 right-8 w-80 z-40"
        data-testid="glass-action-dock"
      >
        <GlassPanel>
          <PrimaryActions product={product} />
        </GlassPanel>
      </aside>

      {/* Mobile: Bottom Sheet */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50">
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExpanded(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              style={{ bottom: "100%" }}
            />
          )}
        </AnimatePresence>

        <motion.div
          initial={false}
          animate={{ 
            y: isExpanded ? 0 : "calc(100% - 64px)" 
          }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="relative"
        >
          <GlassPanel className="ring-white/10 drop-shadow-lg rounded-t-3xl rounded-b-none border-b-0">
            {/* Drag Handle */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="absolute top-3 left-1/2 -translate-x-1/2 w-full max-w-sm flex flex-col items-center gap-2 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 rounded-lg"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse actions" : "Expand actions"}
            >
              <div className="w-12 h-1.5 bg-surface-elevated dark:bg-surface-elevated rounded-full" />
              <div className="flex items-center gap-2 text-sm font-medium text-folio-text-secondary dark:text-folio-text-tertiary">
                <span>{isExpanded ? "Close" : "Product Actions"}</span>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </div>
            </button>

            <div className="pt-12">
              <PrimaryActions product={product} />
            </div>
          </GlassPanel>
        </motion.div>
      </div>
    </>
  );
}

