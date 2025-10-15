'use client';

import { useState, useMemo } from 'react';
import clsx from 'clsx';
import { FaChevronDown, FaChevronUp, FaEllipsisV, FaShoppingBag, FaUpload, FaEdit, FaImage, FaExchangeAlt } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import SafeImage from '@/components/SafeImage';
import { getRoomTemplate, Slot, inferSlotKey, inferSlotKeyFromCategory } from './roomTemplates';
import EditProductDrawer from './EditProductDrawer';
import BoardTileMenu from './BoardTileMenu';
import { computeTileSize } from './tileSizing';

// Types
type Selection = {
  id: string;
  photo?: string | null;
  vendorName?: string | null;
  productName?: string | null;
  colorFinish?: string | null;
  notes?: string | null;
  phaseOfUse?: string | null;
  gpsLocation?: string | null;
  source: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
  roomId?: string | null;
  projectId: string;
  quantity?: number | null;
  specSheetFileName?: string | null;
  specSheetUrl?: string | null;
  unitPrice?: number | null;
  vendorProductId?: string | null;
  vendorRepId?: string | null;
  productUrl?: string | null;
  tags: string[];
  slotKey?: string | null; // Optional slot key for room template tracking
  metadata?: {
    displaySize?: 'auto' | 'large' | 'medium' | 'small';
    featured?: boolean;
  };
};

type Room = {
  id: string;
  name: string;
  type?: string | null; // Room type: KITCHEN, BATH, LIVING, BEDROOM, etc.
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  selections: Selection[];
  paintColor?: {
    name?: string;
    hex?: string;
  } | null;
};

type Size = 'L' | 'M' | 'S';
type TileSize = 'large' | 'medium' | 'small';

// Helper function to convert tile size to span size
function convertTileSize(tileSize: TileSize): Size {
  switch (tileSize) {
    case 'large': return 'L';
    case 'medium': return 'M';
    case 'small': return 'S';
    default: return 'S';
  }
}

type DesignerBoardRoomProps = {
  room: Room;
  projectId: string;
  showAll?: boolean;
  paintAccentEnabled: boolean;
  onPaintAccentToggle: () => void;
  onSelectionSizeOverride: (selectionId: string, newSize: Size | 'auto') => void;
};

// Reuse Festival sizing logic for spans
function spanFor(size: Size, cols: number = 6) {
  if (size === "L") {
    const col = cols >= 6 ? 4 : cols >= 4 ? 3 : 2;
    const row = cols >= 6 ? 34 : cols >= 4 ? 32 : 30;
    return { colSpan: Math.min(col, cols), rowSpan: row };
  }
  if (size === "M") {
    const col = 2;
    const row = cols >= 4 ? 26 : 24;
    return { colSpan: Math.min(col, cols), rowSpan: row };
  }
  // SMALL
  return { colSpan: 1, rowSpan: 18 };
}

function useEstimatedCols() {
  if (typeof window === "undefined") return 4;
  const w = window.innerWidth;
  if (w >= 1280) return 6; // xl
  if (w >= 1024) return 4; // lg
  if (w >= 640) return 2; // sm
  return 1;
}

function pickImage(sel: Selection) {
  return sel.photo || "/images/product-placeholder.jpg";
}

function formatPrice(price?: number | null | any) {
  if (!price) return '';
  // Handle Prisma Decimal type by converting to number
  const numericPrice = typeof price === 'number' ? price : Number(price);
  if (isNaN(numericPrice)) return '';
  
  // Use Intl.NumberFormat for better formatting
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(numericPrice);
}

// Routing helper for shop
function goShop(category: string, projectId: string, roomType: string) {
  const params = new URLSearchParams({
    category: category,
    projectId: projectId,
    room: roomType
  });
  return `/shop?${params.toString()}`;
}

export default function DesignerBoardRoom({
  room,
  projectId,
  showAll = true,
  paintAccentEnabled,
  onPaintAccentToggle,
  onSelectionSizeOverride
}: DesignerBoardRoomProps) {
  const [sizeOverrides, setSizeOverrides] = useState<Record<string, Size>>({});
  const [editing, setEditing] = useState<{ open: boolean; productId?: string; selectionId?: string }>({ open: false });
  const [replacingImage, setReplacingImage] = useState<{ open: boolean; selectionId?: string }>({ open: false });
  const [roleChangePopover, setRoleChangePopover] = useState<{ open: boolean; selectionId?: string }>({ open: false });
  const cols = useEstimatedCols();
  const router = useRouter();

  // Get room template and calculate placeholders
  const roomTemplate = useMemo(() => {
    return room.type ? getRoomTemplate(room.type) : getRoomTemplate(room.name);
  }, [room.type, room.name]);

  // Dev-only diagnostic logs
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[Boards] Room:', room.name, {
      selections: room.selections?.length,
      placeholders: roomTemplate?.slots?.length ?? 0,
    });
  }


  // Helper function to get role label from slotKey
  const getRoleLabel = (slotKey: string | null | undefined) => {
    if (!slotKey || !roomTemplate) return null;
    const slot = roomTemplate.slots.find(s => s.key === slotKey);
    return slot ? slot.label : null;
  };

  // Build items array with real selections prioritized over placeholders
  const { items, realTiles } = useMemo(() => {
    const uniqueSelections = Array.from(new Map(
      (room.selections || []).map(s => [s.id, s])
    ).values());

    const realTiles = uniqueSelections.map(sel => ({
      kind: 'selection' as const,
      key: sel.id,
      sel: {
        ...sel,
        metadata: {
          ...sel.metadata,
          displaySize: sizeOverrides[sel.id] ? sizeOverrides[sel.id].toLowerCase() as any : sel.metadata?.displaySize
        }
      },
      size: computeTileSize({
        ...sel,
        metadata: {
          ...sel.metadata,
          displaySize: sizeOverrides[sel.id] ? sizeOverrides[sel.id].toLowerCase() as any : sel.metadata?.displaySize
        }
      }),
    }));

    // Determine which template slots are already filled.
    // Prefer explicit slotKey; if missing, infer from category so placeholders disappear.
    const filledSlots = new Set<string>([
      ...uniqueSelections.map(s => s.slotKey).filter(Boolean) as string[],
      ...uniqueSelections
        .map(s => inferSlotKeyFromCategory((s as any).category || (s as any).product?.category))
        .filter(Boolean) as string[],
    ]);

    const placeholderTiles = (roomTemplate?.slots || [])
      .filter(slot => !filledSlots.has(slot.key))
      .map(slot => ({
        kind: 'placeholder' as const,
        key: `${room.id}:${slot.key}`,
        slot,
      }));

    // ABSOLUTE RULE: real selections must render first; placeholders never suppress real cards.
    const items = [...realTiles, ...placeholderTiles];

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[Boards]', room.name, {
        selections: room.selections?.length ?? 0,
        realRendered: realTiles.length,
        placeholders: placeholderTiles.length,
        totalItems: items.length,
        filledSlots: Array.from(filledSlots),
      });
    }

    return { items, realTiles };
  }, [room.selections, roomTemplate, sizeOverrides, room.id]);


  const handleSizeOverride = (selectionId: string, newSize: Size | 'auto') => {
    if (newSize === 'auto') {
      setSizeOverrides(prev => {
        const { [selectionId]: _, ...rest } = prev;
        return rest;
      });
    } else {
      setSizeOverrides(prev => ({
        ...prev,
        [selectionId]: newSize
      }));
    }
    onSelectionSizeOverride(selectionId, newSize);
  };

  const handleRoleChange = async (selectionId: string, newSlotKey: string) => {
    try {
      // Check for conflicts
      if (newSlotKey) {
        const conflictingSelection = room.selections.find(
          sel => sel.id !== selectionId && sel.slotKey === newSlotKey
        );
        
        if (conflictingSelection) {
          const confirmed = window.confirm(
            `This role is already filled by "${conflictingSelection.productName || 'Untitled Product'}". Continue will reassign the role to this item.`
          );
          if (!confirmed) return;
        }
      }

      const response = await fetch(`/api/selections/${selectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotKey: newSlotKey || null,
          uiMeta: {
            slotKey: newSlotKey
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      // Close popover and refresh
      setRoleChangePopover({ open: false });
      router.refresh();
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Room Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h3 className="text-xl font-semibold text-gray-900">{room.name}</h3>
          
          {/* Paint Color Swatch */}
          {room.paintColor && (
            <div className="flex items-center space-x-2">
              <div 
                className="w-6 h-6 rounded-full border border-gray-300 shadow-sm"
                style={{ backgroundColor: room.paintColor.hex || '#f3f4f6' }}
                title={room.paintColor.name || 'Paint color'}
              />
              <span className="text-sm text-gray-600">
                {room.paintColor.name || room.paintColor.hex}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {/* Paint Accent Toggle */}
          {room.paintColor && (
            <button
              onClick={onPaintAccentToggle}
              className={clsx(
                "px-3 py-1 text-xs rounded-full border transition-colors",
                paintAccentEnabled
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              )}
            >
              Paint Accent
            </button>
          )}
          
          <div className="text-sm text-gray-500">
            {realTiles.length} item{realTiles.length !== 1 ? 's' : ''}
          </div>
          
          {/* Add Tile Button */}
          <button
            onClick={() => setEditing({ open: true, productId: undefined, selectionId: undefined })}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaUpload className="w-3 h-3" />
            <span>Add Tile</span>
          </button>
        </div>
      </div>

      {/* Mosaic Grid */}
      <div className={clsx(
        "grid grid-flow-dense gap-3",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6",
        "auto-rows-[8px]"
      )}>
        {items.map((item) => {
          if (item.kind === 'selection') {
            const { sel: selection, size } = item;
          const { colSpan, rowSpan } = spanFor(convertTileSize(size), cols);
          const img = pickImage(selection);
          const currentOverride = sizeOverrides[selection.id];

          return (
              <article
                key={selection.id}
              className={clsx(
                "group relative rounded-xl border shadow-sm bg-white overflow-hidden",
                paintAccentEnabled && room.paintColor
                  ? "border-gray-300" // Subtle border, not overwhelming
                  : "border-folio-border",
                `col-span-${colSpan}`
              )}
              style={{ 
                gridRowEnd: `span ${rowSpan}`,
                ...(paintAccentEnabled && room.paintColor ? {
                  borderColor: room.paintColor.hex || '#d1d5db',
                  borderWidth: '2px'
                } : {})
              }}
            >
              {/* Selection Menu */}
              <BoardTileMenu
                selection={selection}
                onEdit={(selId, productId) => setEditing({ open: true, productId, selectionId: selId })}
                onReplaceImage={(selId) => setReplacingImage({ open: true, selectionId: selId })}
                onOverrideSize={handleSizeOverride}
                currentOverride={currentOverride}
                editable={true}
              />

              <div className="relative h-full">
                {/* Image */}
                <div className="absolute inset-0 pointer-events-none">
                  <SafeImage
                    src={img}
                    alt={selection.productName || "Product"}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                </div>

                {/* Content Overlay */}
                <div className="relative z-20 pointer-events-none flex h-full items-end p-3">
                  <div className="text-white w-full">
                    <div className={clsx("font-semibold leading-tight",
                      size === "large" ? "text-xl" : size === "medium" ? "text-lg" : "text-sm"
                    )}>
                      {selection.productName || "Untitled Product"}
                    </div>
                    
                    {/* Meta Info */}
                    <div className="text-xs opacity-90 mt-1 space-y-1">
                      {selection.vendorName && (
                        <div>{selection.vendorName}</div>
                      )}
                      {selection.unitPrice && (
                        <div>{formatPrice(selection.unitPrice)}</div>
                      )}
                      {currentOverride && (
                        <div className="text-yellow-300">● {currentOverride}</div>
                      )}
                      {getRoleLabel(selection.slotKey) && (
                        <div className="text-blue-300 flex items-center gap-1">
                          <span>Role: {getRoleLabel(selection.slotKey)}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoleChangePopover({ open: true, selectionId: selection.id });
                            }}
                            className="opacity-70 hover:opacity-100 transition-opacity"
                          >
                            <FaExchangeAlt className="w-2 h-2" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              </article>
            );
          } else if (item.kind === 'placeholder') {
            const { slot } = item;
            const { colSpan, rowSpan } = spanFor(convertTileSize(slot.defaultSize), cols);
            
            return (
              <article
                key={`${room.id}:${slot.key}`}
                className={clsx(
                  "group relative rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 opacity-60",
                  paintAccentEnabled && room.paintColor
                    ? "border-gray-400"
                    : "border-gray-300",
                  `col-span-${colSpan}`
                )}
                style={{ 
                  gridRowEnd: `span ${rowSpan}`,
                  ...(paintAccentEnabled && room.paintColor ? {
                    borderColor: room.paintColor.hex || '#9ca3af',
                    borderWidth: '2px'
                  } : {})
                }}
              >
                <div className="relative h-full flex flex-col items-center justify-center p-4 text-center">
                  {/* Placeholder Content */}
                  <div className="text-gray-600 mb-4">
                    <div className={clsx("font-semibold mb-2",
                      slot.defaultSize === 'large' ? "text-lg" : slot.defaultSize === 'medium' ? "text-base" : "text-sm"
                    )}>
                      {slot.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {slot.category}
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex flex-col space-y-2 w-full max-w-32">
                    <button
                      onClick={() => router.push(goShop(slot.category, projectId, room.type || room.name))}
                      className="flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <FaShoppingBag className="w-3 h-3" />
                      <span>Shop</span>
                    </button>
                    <button
                      onClick={() => {
                        // TODO: Open upload flow scoped to this room/slot
                        console.log('Upload for slot:', slot.key, 'in room:', room.id);
                      }}
                      className="flex items-center justify-center space-x-2 px-3 py-2 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <FaUpload className="w-3 h-3" />
                      <span>Upload</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          }
          return null;
        })}
      </div>

      {/* Add Tile Button Footer */}
      <footer className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => setEditing({ open: true, productId: undefined, selectionId: undefined })}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99] transition"
        >
          + Add Tile
        </button>
      </footer>

      {/* Edit Product Drawer */}
      <EditProductDrawer
        open={editing.open}
        onClose={() => setEditing({ open: false })}
        productId={editing.productId}
        selectionId={editing.selectionId}
        projectId={projectId}
        roomId={room.id}
        roomType={room.type || room.name}
      />

      {/* Image Replacement Modal */}
      {replacingImage.open && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setReplacingImage({ open: false })} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-lg shadow-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Replace Image</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setReplacingImage({ open: false })}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // TODO: Implement image replacement
                    setReplacingImage({ open: false });
                    router.refresh();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Replace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Popover */}
      {roleChangePopover.open && roomTemplate && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setRoleChangePopover({ open: false })} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-lg shadow-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Change Role</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleRoleChange(roleChangePopover.selectionId!, '')}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded"
              >
                None / Unassigned
              </button>
              {roomTemplate.slots.map((slot: any) => {
                const isTaken = room.selections.some(
                  sel => sel.id !== roleChangePopover.selectionId && sel.slotKey === slot.key
                );
                const isCurrent = room.selections.find(
                  sel => sel.id === roleChangePopover.selectionId
                )?.slotKey === slot.key;
                
                return (
                  <button
                    key={slot.key}
                    onClick={() => handleRoleChange(roleChangePopover.selectionId!, slot.key)}
                    className={clsx(
                      "w-full text-left px-3 py-2 text-sm rounded",
                      isCurrent 
                        ? "bg-blue-100 text-blue-800" 
                        : isTaken 
                          ? "bg-red-50 text-red-700 hover:bg-red-100" 
                          : "hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{slot.label}</span>
                      {isTaken && <span className="text-xs opacity-75">(taken)</span>}
                      {isCurrent && <span className="text-xs opacity-75">(current)</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setRoleChangePopover({ open: false })}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
