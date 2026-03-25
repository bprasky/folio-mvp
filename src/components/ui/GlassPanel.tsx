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
 * GlassPanel - Frosted glass container using unified glass-tokens
 * Warm ivory glass with subtle inner highlight
 */
export function GlassPanel({
  children,
  className,
  header,
  as: Component = "div",
  variant = 'default'
}: GlassPanelProps) {
  const glassClass = 'glass-surface';
  
  return (
    <Component
      className={cn(
        glassClass,
        className
      )}
    >
      {header && (
        <div className="px-5 md:px-6 pt-5 pb-3 border-b border-[var(--glass-border)] dark:border-white/5">
          {header}
        </div>
      )}
      <div className={cn(header ? "p-5 md:p-6" : "p-5 md:p-6")}>
        {children}
      </div>
    </Component>
  );
}

