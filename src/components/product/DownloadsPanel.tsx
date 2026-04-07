"use client";

import React from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { CollapsibleSection } from "./CollapsibleSection";
import { Product, FileLink } from "@/lib/mock/product";
import { FileText, Box, Download } from "lucide-react";

interface DownloadsPanelProps {
  product: Product;
}

export function DownloadsPanel({ product }: DownloadsPanelProps) {
  const { files } = product;
  const hasFiles = files.specSheets.length > 0 || files._3d.length > 0 || (files.others?.length ?? 0) > 0;
  if (!hasFiles) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
    >
      <GlassPanel
        header={
          <h2 className="text-lg font-medium text-stone-900 dark:text-stone-100">
            Files & Downloads
          </h2>
        }
      >
        <div className="space-y-0">
          {files.specSheets.length > 0 && (
            <CollapsibleSection title="Spec Sheets" defaultOpen>
              <FileList items={files.specSheets} icon={FileText} />
            </CollapsibleSection>
          )}

          {files._3d.length > 0 && (
            <CollapsibleSection title="3D Files">
              <FileList items={files._3d} icon={Box} />
            </CollapsibleSection>
          )}

          {files.others && files.others.length > 0 && (
            <CollapsibleSection title="Additional Resources">
              <FileList items={files.others} icon={Download} />
            </CollapsibleSection>
          )}
        </div>
      </GlassPanel>
    </motion.div>
  );
}

function FileList({ 
  items, 
  icon: Icon 
}: { 
  items: FileLink[]; 
  icon: React.ElementType;
}) {
  const getFileType = (href: string) => {
    const ext = href.split('.').pop()?.toLowerCase();
    return ext || 'file';
  };

  const getFileTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'pdf': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      'glb': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'gltf': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'obj': 'bg-[var(--accent)]/10 text-[var(--accent-hover)] dark:bg-blue-900/30 dark:text-blue-300',
      'fbx': 'bg-[var(--accent)]/10 text-[var(--accent-hover)] dark:bg-blue-900/30 dark:text-blue-300',
      'dwg': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      'rvt': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    };
    return colors[type] || 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300';
  };

  return (
    <div className="space-y-2">
      {items.map((file, index) => {
        const fileType = getFileType(file.href);
        return (
          <a
            key={index}
            href={file.href}
            className="flex items-center gap-3 p-3 rounded-lg border border-white/10 dark:border-white/5 bg-white/5 dark:bg-stone-800/20 hover:bg-white/10 dark:hover:bg-stone-800/40 transition-all group"
            download
          >
            <Icon className="w-5 h-5 text-stone-500 dark:text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200 transition-colors flex-shrink-0" />
            
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                {file.label}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-1.5 py-0.5 rounded uppercase font-medium ${getFileTypeColor(fileType)}`}>
                  {fileType}
                </span>
              </div>
            </div>
            
            <Download className="w-4 h-4 text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors flex-shrink-0" />
          </a>
        );
      })}
    </div>
  );
}

