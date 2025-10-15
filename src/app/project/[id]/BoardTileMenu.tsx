'use client';

import { FaEllipsisV, FaEdit, FaImage } from 'react-icons/fa';
import clsx from 'clsx';

type BoardTileMenuProps = {
  selection: any; // Selection type
  product?: any;
  onEdit: (selId: string, productId?: string) => void;
  onReplaceImage?: (selId: string) => void;
  onOverrideSize?: (selId: string, size: 'auto'|'large'|'medium'|'small') => void;
  onFeatureToggle?: (selId: string, featured: boolean) => void;
  editable?: boolean; // disabled for placeholders
  currentOverride?: string;
};

export default function BoardTileMenu({
  selection,
  product,
  onEdit,
  onReplaceImage,
  onOverrideSize,
  onFeatureToggle,
  editable = true,
  currentOverride
}: BoardTileMenuProps) {
  if (!editable) {
    return null; // Don't show menu for placeholders
  }

  return (
    <div className="absolute top-2 right-2 z-40 opacity-0 group-hover:opacity-100 transition-opacity">
      <div className="relative">
        <button className="p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors">
          <FaEllipsisV className="w-3 h-3" />
        </button>
        
        {/* Dropdown Menu */}
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <button
            onClick={() => onEdit(selection.id, product?.id)}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700 flex items-center gap-2"
          >
            <FaEdit className="w-3 h-3" />
            Edit
          </button>
          
          {onReplaceImage && (
            <button
              onClick={() => onReplaceImage(selection.id)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700 flex items-center gap-2"
            >
              <FaImage className="w-3 h-3" />
              Replace Image
            </button>
          )}
          
          {onOverrideSize && (
            <>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                onClick={() => onOverrideSize(selection.id, 'large')}
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm hover:bg-gray-50",
                  currentOverride === 'L' ? "text-blue-600 font-medium" : "text-gray-700"
                )}
              >
                Feature tile (Large)
              </button>
              <button
                onClick={() => onOverrideSize(selection.id, 'small')}
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm hover:bg-gray-50",
                  currentOverride === 'S' ? "text-blue-600 font-medium" : "text-gray-700"
                )}
              >
                Demote tile (Small)
              </button>
              <button
                onClick={() => onOverrideSize(selection.id, 'auto')}
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm hover:bg-gray-50",
                  !currentOverride ? "text-blue-600 font-medium" : "text-gray-700"
                )}
              >
                Reset to Auto
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

