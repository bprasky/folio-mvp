"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
  variant?: 'default' | 'heavy' | 'light';
}

/**
 * GlassPanel - Frosted glass container using namespaced folio-glass token
 * Light, airy 10% white glass with subtle highlight
 * Uses .folio-glass to avoid conflicts with legacy .glass/.card-glass
 */
export function GlassPanel({ 
  children, 
  className, 
  header,
  as: Component = "div",
  variant = 'default'
}: GlassPanelProps) {
  // All variants use namespaced folio-glass (wins cascade with !important)
  const glassClass = 'folio-glass folio-glass--highlight';
  
  return (
    <Component
      className={cn(
        glassClass,
        className
      )}
    >
      {header && (
        <div className="px-5 md:px-6 pt-5 pb-3 border-b border-white/20 dark:border-white/5">
          {header}
        </div>
      )}
      <div className={cn(header ? "p-5 md:p-6" : "p-5 md:p-6")}>
        {children}
      </div>
    </Component>
  );
}

