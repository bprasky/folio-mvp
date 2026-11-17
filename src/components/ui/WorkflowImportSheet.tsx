"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import styles from "./WorkflowForms.module.css";

/** Wider review sheet for document/photo imports; preserves the host's close guard. */
export function WorkflowImportSheet({ open, onOpenChange, title, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange} placement="right" backdropClassName="bg-black/40">
    <DialogContent placement="right" className={styles.importSheet} aria-describedby={undefined}>
      <DialogTitle className="sr-only">{title}</DialogTitle>{children}
    </DialogContent>
  </Dialog>;
}
export function WorkflowImportHeader({ children }: { children: ReactNode }) {
  return <div className={styles.importHeader}>{children}</div>;
}
export function WorkflowImportBody({ children }: { children: ReactNode }) {
  return <div className={styles.sheetBody}>{children}</div>;
}
