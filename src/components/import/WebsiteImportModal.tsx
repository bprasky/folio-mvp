"use client";

import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProjectGuideUploads } from "@/components/interviews/ProjectGuideUploads";
import styles from "@/components/ui/WorkflowForms.module.css";

export function WebsiteImportModal({ open, onOpenChange, projectId, onComplete }: {
  open: boolean; onOpenChange: (open: boolean) => void; projectId: string; onComplete: () => void;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange} placement="right" backdropClassName="bg-black/40">
    <DialogContent placement="right" className={styles.sheet}>
      <div className={styles.sheetHeader}>
        <div><p className={styles.eyebrow}>Bring your work into Folio</p><DialogTitle className={styles.sheetTitle}>Import your photographs</DialogTitle><DialogDescription className={`${styles.help} mt-3`}>Start with a project link, then choose the photographs to keep.</DialogDescription></div>
        <button type="button" onClick={() => onOpenChange(false)} className={styles.close} aria-label="Close photo import"><X size={18} /></button>
      </div>
      <div className={styles.sheetBody}><ProjectGuideUploads key={projectId} projectId={projectId} onAdded={(_id, _photos, complete) => { onComplete(); if (complete) onOpenChange(false); }} /></div>
    </DialogContent>
  </Dialog>;
}
