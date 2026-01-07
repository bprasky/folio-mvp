'use client';

import { useState, useRef, useEffect } from 'react';
import { FaEllipsisV, FaEdit, FaImage, FaTrash } from 'react-icons/fa';
import clsx from 'clsx';

type BoardTileMenuProps = {
  selection: any; // Selection type
  product?: any;
  onEdit: (selId: string, productId?: string) => void;
  onReplaceImage?: (selId: string) => void;
  onOverrideSize?: (selId: string, size: 'auto'|'large'|'medium'|'small') => void;
  onFeatureToggle?: (selId: string, featured: boolean) => void;
  onDelete?: (selId: string) => void;
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
  onDelete,
  editable = true,
  currentOverride
}: BoardTileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!editable) {
    return null; // Don't show menu for placeholders
  }

  return (
    <div className="absolute top-2 right-2 z-40 opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
      <div className="relative">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
        >
          <FaEllipsisV className="w-3 h-3" />
        </button>
        
        {/* Dropdown Menu */}
        {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onEdit(selection.id, product?.id);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-700 flex items-center gap-2"
          >
            <FaEdit className="w-3 h-3" />
            Edit
          </button>
          
          {onReplaceImage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onReplaceImage(selection.id);
              }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onOverrideSize(selection.id, 'large');
                }}
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm hover:bg-gray-50",
                  currentOverride === 'L' ? "text-blue-600 font-medium" : "text-gray-700"
                )}
              >
                Feature tile (Large)
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onOverrideSize(selection.id, 'small');
                }}
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm hover:bg-gray-50",
                  currentOverride === 'S' ? "text-blue-600 font-medium" : "text-gray-700"
                )}
              >
                Demote tile (Small)
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onOverrideSize(selection.id, 'auto');
                }}
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm hover:bg-gray-50",
                  !currentOverride ? "text-blue-600 font-medium" : "text-gray-700"
                )}
              >
                Reset to Auto
              </button>
            </>
          )}
          
          {onDelete && (
            <>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onDelete(selection.id);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
              >
                <FaTrash className="w-3 h-3" />
                Delete
              </button>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

