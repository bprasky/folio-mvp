"use client";
import { Button } from "@/components/ui/button";

export function ExportButton() {
  return (
    <Button onClick={() => window.print()} variant="outline" size="sm">
      Export PDF
    </Button>
  );
}








