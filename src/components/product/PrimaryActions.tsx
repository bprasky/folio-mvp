"use client";

import { Product } from "@/lib/mock/product";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Heart, FolderPlus, ShoppingCart, FileDown, Box, Share2 } from "lucide-react";

export function PrimaryActions({ product }: { product: Product }) {
  const { toast } = useToast();
  const act = (msg: string) => toast({ title: msg });

  return (
    <div className="space-y-3">
      {/* Primary Action - Visually Dominant */}
      <Button 
        onClick={()=>act("Material Bank sample requested")} 
        className="w-full bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-stone-200 text-white dark:text-stone-900 py-3"
        size="lg"
      >
        <ShoppingCart className="w-4 h-4 mr-2" />
        Order Sample
      </Button>
      
      {/* Secondary Actions - Ghost */}
      <div className="flex flex-col gap-2 pt-2">
        <Button 
          onClick={()=>act("Saved to Moodboard")} 
          variant="ghost"
          className="w-full justify-start text-stone-700 dark:text-stone-300 hover:bg-white/10 dark:hover:bg-white/5"
          size="sm"
        >
          <Heart className="w-3.5 h-3.5 mr-2" />
          Save to Moodboard
        </Button>
        <Button 
          onClick={()=>act("Added to Project")} 
          variant="ghost"
          className="w-full justify-start text-stone-700 dark:text-stone-300 hover:bg-white/10 dark:hover:bg-white/5"
          size="sm"
        >
          <FolderPlus className="w-3.5 h-3.5 mr-2" />
          Add to Project
        </Button>
        <Button 
          onClick={()=>act("Spec Sheet download")} 
          variant="ghost"
          className="w-full justify-start text-stone-700 dark:text-stone-300 hover:bg-white/10 dark:hover:bg-white/5"
          size="sm"
        >
          <FileDown className="w-3.5 h-3.5 mr-2" />
          Download Spec
        </Button>
        <Button 
          onClick={()=>act("3D File download")} 
          variant="ghost"
          className="w-full justify-start text-stone-700 dark:text-stone-300 hover:bg-white/10 dark:hover:bg-white/5"
          size="sm"
        >
          <Box className="w-3.5 h-3.5 mr-2" />
          Download 3D
        </Button>
        <Button 
          onClick={()=>act("Shared product link")} 
          variant="ghost"
          className="w-full justify-start text-stone-700 dark:text-stone-300 hover:bg-white/10 dark:hover:bg-white/5"
          size="sm"
        >
          <Share2 className="w-3.5 h-3.5 mr-2" />
          Share
        </Button>
      </div>
      
      <div className="text-xs text-stone-500/80 dark:text-stone-400/80 pt-3 border-t border-white/10 dark:border-white/5 leading-relaxed">
        💡 Connect Material Bank + Folio to auto-log sampling
      </div>
    </div>
  );
}


