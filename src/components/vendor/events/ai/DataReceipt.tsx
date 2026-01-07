import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AiReceiptItem } from "@/lib/ai/types";

interface DataReceiptProps {
  items: AiReceiptItem[];
  onOpen: (item: AiReceiptItem) => void;
}

export function DataReceipt({ items, onOpen }: DataReceiptProps) {
  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium text-[#8C8278] mb-2">Supporting Data:</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <div key={index} className="group inline-flex items-center gap-2 rounded-lg border border-[#DAD2CA] bg-white/80 px-3 py-2 hover:bg-white hover:shadow-sm transition-all duration-200">
            <span className="text-sm font-medium text-[#2B2B2B]">{item.label}:</span>
            <Badge variant="secondary" className="bg-[#8C8278] text-white font-medium">{item.value}</Badge>
            {item.hint && <span className="text-xs text-[#8C8278] italic">{item.hint}</span>}
            {item.section && (
              <Button 
                variant="ghost" 
                size="sm"
                className="px-2 text-xs text-[#8C8278] hover:text-[#2B2B2B] opacity-0 group-hover:opacity-100 transition-opacity" 
                onClick={() => onOpen(item)}
              >
                View Details →
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
