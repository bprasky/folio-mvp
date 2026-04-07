"use client";

import React from "react";
import { Product } from "@/lib/mock/product";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";

export function PrimaryActions({ product }: { product: Product }) {
  const { toast } = useToast();
  const act = (msg: string) => toast({ title: msg });

  return (
    <Card className="p-4 space-y-3">
      <div className="text-sm text-folio-text-secondary">Actions</div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={()=>act("Saved to Moodboard")} variant="secondary">Save to Moodboard</Button>
        <Button onClick={()=>act("Added to Project")} variant="secondary">Add to Project</Button>
        <Button onClick={()=>act("Material Bank sample requested")} className="">Order Sample (Material Bank)</Button>
        <Button onClick={()=>act("Spec Sheet download")} variant="outline">Download Spec Sheet</Button>
        <Button onClick={()=>act("3D File download")} variant="outline">Download 3D</Button>
        <Button onClick={()=>act("Shared product link")} variant="ghost">Share</Button>
      </div>
      <div className="text-xs text-folio-text-tertiary">
        Tip: connect Material Bank + Folio to auto-log sampling events into project timelines.
      </div>
    </Card>
  );
}
