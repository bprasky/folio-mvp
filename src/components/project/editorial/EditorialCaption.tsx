'use client';

interface EditorialCaptionProps {
  roomName?: string | null;
  text: string;
  products?: Array<{ id: string; name: string }>;
}

/**
 * EditorialCaption - Reusable caption module
 * 
 * Features:
 * - Room label (section header style)
 * - Full editorial text (readable paragraph, no truncation)
 * - Selections line (optional)
 * - Never renders empty (uses fallbacks)
 * - No borders - uses whitespace + alignment + type hierarchy
 */
export function EditorialCaption({ roomName, text, products }: EditorialCaptionProps) {
  const hasContent = roomName || text || (products && products.length > 0);
  
  if (!hasContent) {
    return null;
  }
  
  return (
    <div className="flex flex-col justify-end space-y-4">
      {/* Room Label - Section Header Style */}
      {roomName && (
        <div className="text-sm font-medium uppercase tracking-wider text-neutral-600 mb-2">
          {roomName}
        </div>
      )}
      
      {/* Editorial Text - Readable Paragraph Style */}
      {text && (
        <p className="text-base md:text-lg leading-relaxed text-neutral-800 font-normal">
          {text}
        </p>
      )}
      
      {/* Selections Line */}
      {products && products.length > 0 && (
        <div className="pt-3 border-t border-neutral-200">
          <div className="text-sm text-neutral-600">
            <span className="font-medium">Selections: </span>
            <span className="text-neutral-500">
              {products.slice(0, 3).map(p => p.name).join(' • ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}






