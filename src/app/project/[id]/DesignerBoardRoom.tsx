'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { FaChevronDown, FaChevronUp, FaEllipsisV, FaShoppingBag, FaUpload, FaEdit, FaImage, FaExchangeAlt, FaTrash } from 'react-icons/fa';
import { HiOutlineDotsVertical } from 'react-icons/hi';
import { useRouter } from 'next/navigation';
import SafeImage from '@/components/SafeImage';
import { formatRoomName } from '@/lib/utils/formatRoomName';
import { getRoomTemplate, Slot, inferSlotKey, inferSlotKeyFromCategory, ROOM_TEMPLATES } from './roomTemplates';
import EditProductDrawer from './EditProductDrawer';
import BoardTileMenu from './BoardTileMenu';
import SaveSelectionToProjectModal from './SaveSelectionToProjectModal';
import ManualQuoteEntryModal from './ManualQuoteEntryModal';
import { computeTileSize } from './tileSizing';

// Room type suggestions for the combobox (known types get placeholder templates; custom types are fine too)
const ROOM_TYPE_SUGGESTIONS = [
  'Kitchen', 'Bathroom', 'Living Room', 'Bedroom',
  'Dining Room', 'Office', 'Entry / Foyer',
  'Bar', 'Wine Cellar', 'Gym', 'Sauna',
  'Exterior', 'Patio', 'Pool House',
  'Mudroom', 'Laundry', 'Pantry', 'Walk-In Closet',
  'Media Room', 'Library', 'Nursery', 'Playroom',
  'Hallway', 'Garage', 'Sunroom', 'Lounge',
  'Powder Room', 'Study', 'Home Theater',
  'Pool', 'Butler Pantry',
];

// Maps display labels to internal type keys for known template types
const DISPLAY_TO_TYPE_KEY: Record<string, string> = {
  'kitchen': 'KITCHEN',
  'bathroom': 'BATH',
  'living room': 'LIVING',
  'bedroom': 'BEDROOM',
  'dining room': 'DINING',
  'office': 'OFFICE',
  'entry / foyer': 'ENTRY',
  'bar': 'BAR',
  'pantry': 'PANTRY',
  'laundry': 'LAUNDRY',
  'mudroom': 'MUDROOM',
  'nursery': 'NURSERY',
  'playroom': 'PLAYROOM',
  'home theater': 'HOME_THEATER',
  'gym': 'GYM',
  'pool': 'POOL',
  'sunroom': 'SUNROOM',
  'powder room': 'POWDER_ROOM',
  'library': 'LIBRARY',
  'study': 'STUDY',
  'lounge': 'LOUNGE',
  'wine cellar': 'WINE_CELLAR',
  'walk-in closet': 'WALK_IN_CLOSET',
  'butler pantry': 'BUTLER_PANTRY',
};

// Maps internal type keys back to display labels
const TYPE_KEY_TO_DISPLAY: Record<string, string> = {
  'KITCHEN': 'Kitchen',
  'BATH': 'Bathroom',
  'LIVING': 'Living Room',
  'BEDROOM': 'Bedroom',
  'DINING': 'Dining Room',
  'OFFICE': 'Office',
  'ENTRY': 'Entry / Foyer',
  'BAR': 'Bar',
  'PANTRY': 'Pantry',
  'LAUNDRY': 'Laundry',
  'MUDROOM': 'Mudroom',
  'NURSERY': 'Nursery',
  'PLAYROOM': 'Playroom',
  'HOME_THEATER': 'Home Theater',
  'GYM': 'Gym',
  'POOL': 'Pool',
  'SUNROOM': 'Sunroom',
  'POWDER_ROOM': 'Powder Room',
  'LIBRARY': 'Library',
  'STUDY': 'Study',
  'LOUNGE': 'Lounge',
  'WINE_CELLAR': 'Wine Cellar',
  'WALK_IN_CLOSET': 'Walk-In Closet',
  'BUTLER_PANTRY': 'Butler Pantry',
};

function displayToTypeKey(display: string): string | null {
  if (!display.trim()) return null;
  return DISPLAY_TO_TYPE_KEY[display.toLowerCase().trim()] || display.toUpperCase().replace(/\s+/g, '_');
}

function typeKeyToDisplay(key: string | null | undefined): string {
  if (!key) return '';
  return TYPE_KEY_TO_DISPLAY[key] || formatRoomName(key);
}

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

type PricingEntry = {
  status: string;
  unitPriceTrade: number | null;
  leadTimeWeeks: number | null;
  availability: string | null;
};

type DesignerBoardRoomProps = {
  room: Room;
  projectId: string;
  showAll?: boolean;
  paintAccentEnabled: boolean;
  onPaintAccentToggle: () => void;
  onSelectionSizeOverride: (selectionId: string, newSize: Size | 'auto') => void;
  onRoomUpdate?: (roomId: string, data: { name?: string; type?: string | null }) => Promise<void>;
  onRoomDelete?: (roomId: string) => Promise<void>;
  pricingData?: Record<string, PricingEntry>;
  onPricingRefresh?: () => void;
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
  onSelectionSizeOverride,
  onRoomUpdate,
  onRoomDelete,
  pricingData = {},
  onPricingRefresh,
}: DesignerBoardRoomProps) {
  const [sizeOverrides, setSizeOverrides] = useState<Record<string, Size>>({});
  const [editing, setEditing] = useState<{ open: boolean; productId?: string; selectionId?: string; slotKey?: string }>({ open: false });
  const [replacingImage, setReplacingImage] = useState<{ open: boolean; selectionId?: string }>({ open: false });
  const [roleChangePopover, setRoleChangePopover] = useState<{ open: boolean; selectionId?: string }>({ open: false });
  const [saveToProjectSelection, setSaveToProjectSelection] = useState<Selection | null>(null);
  const [quoteEntrySelection, setQuoteEntrySelection] = useState<Selection | null>(null);

  // Room menu state
  const [roomMenuOpen, setRoomMenuOpen] = useState(false);
  const [roomEditOpen, setRoomEditOpen] = useState(false);
  const [editingRoomName, setEditingRoomName] = useState(room.name);
  const [editingRoomType, setEditingRoomType] = useState<string>(room.type || '');
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const roomMenuRef = useRef<HTMLDivElement>(null);

  const cols = useEstimatedCols();
  const router = useRouter();

  // Close room menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roomMenuRef.current && !roomMenuRef.current.contains(event.target as Node)) {
        setRoomMenuOpen(false);
      }
    }
    if (roomMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [roomMenuOpen]);

  // Reset edit form when modal opens
  useEffect(() => {
    if (roomEditOpen) {
      setEditingRoomName(room.name);
      setEditingRoomType(typeKeyToDisplay(room.type));
    }
  }, [roomEditOpen, room.name, room.type]);

  // Room edit handler
  const handleSaveRoom = async () => {
    if (!editingRoomName.trim()) return;
    setIsSavingRoom(true);
    const typeKey = displayToTypeKey(editingRoomType);
    try {
      if (onRoomUpdate) {
        await onRoomUpdate(room.id, {
          name: editingRoomName.trim(),
          type: typeKey
        });
      } else {
        // Fallback: call API directly
        const res = await fetch(`/api/projects/${projectId}/rooms/${room.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editingRoomName.trim(),
            type: typeKey
          })
        });
        if (!res.ok) throw new Error('Failed to update room');
        router.refresh();
      }
      setRoomEditOpen(false);
    } catch (error) {
      console.error('Error updating room:', error);
      alert('Failed to update room. Please try again.');
    } finally {
      setIsSavingRoom(false);
    }
  };

  // Room delete handler
  const handleDeleteRoom = async () => {
    const selectionCount = room.selections?.length || 0;
    const message = selectionCount > 0
      ? `Delete "${room.name}"? This will also delete ${selectionCount} item${selectionCount !== 1 ? 's' : ''} in this room.`
      : `Delete "${room.name}"?`;

    if (!confirm(message)) return;

    setIsDeletingRoom(true);
    try {
      if (onRoomDelete) {
        await onRoomDelete(room.id);
      } else {
        // Fallback: call API directly
        const res = await fetch(`/api/projects/${projectId}/rooms/${room.id}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete room');
        router.refresh();
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      alert('Failed to delete room. Please try again.');
    } finally {
      setIsDeletingRoom(false);
      setRoomMenuOpen(false);
    }
  };

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

  const handleDeleteSelection = async (selectionId: string) => {
    if (!confirm('Are you sure you want to delete this selection?')) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/rooms/${room.id}/selections/${selectionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete selection' }));
        throw new Error(errorData.error || `Failed to delete selection (${response.status})`);
      }

      // Refresh the page to update the board
      router.refresh();
    } catch (error: any) {
      console.error('Error deleting selection:', error);
      alert(error?.message || 'Failed to delete selection. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Room Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h3 className="folio-h3 text-folio-text-primary">{formatRoomName(room.name)}</h3>

          {/* Room Type Badge */}
          {room.type && (
            <span className="px-2 py-0.5 folio-meta text-folio-text-tertiary bg-surface-ground rounded border border-folio-border-subtle">
              {typeKeyToDisplay(room.type)}
            </span>
          )}

          {/* Room Menu */}
          <div className="relative" ref={roomMenuRef}>
            <button
              onClick={() => setRoomMenuOpen(!roomMenuOpen)}
              className="p-1.5 rounded-md hover:bg-surface-ground text-folio-text-tertiary hover:text-folio-text-primary transition-colors"
              title="Room options"
            >
              <HiOutlineDotsVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {roomMenuOpen && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-surface-canvas border border-folio-border-subtle rounded-lg shadow-lg z-50 overflow-hidden">
                <button
                  onClick={() => {
                    setRoomMenuOpen(false);
                    setRoomEditOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left folio-ui text-folio-text-primary hover:bg-surface-ground flex items-center gap-2"
                >
                  <FaEdit className="w-3 h-3" />
                  Edit Room
                </button>
                <button
                  onClick={handleDeleteRoom}
                  disabled={isDeletingRoom}
                  className="w-full px-3 py-2 text-left folio-ui text-[rgb(74,44,59)] hover:bg-stone-100 flex items-center gap-2"
                >
                  <FaTrash className="w-3 h-3" />
                  {isDeletingRoom ? 'Deleting...' : 'Delete Room'}
                </button>
              </div>
            )}
          </div>

          {/* Paint Color Swatch */}
          {room.paintColor && (
            <div className="flex items-center space-x-2">
              <div
                className="w-6 h-6 rounded-full border border-folio-border-subtle shadow-sm"
                style={{ backgroundColor: room.paintColor.hex || '#f3f4f6' }}
                title={room.paintColor.name || 'Paint color'}
              />
              <span className="folio-ui text-folio-text-secondary">
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
                "px-3 py-1 folio-meta rounded-full border transition-colors",
                paintAccentEnabled
                  ? "bg-[var(--text-primary)] text-white border-[var(--text-primary)]"
                  : "bg-surface-ground text-folio-text-secondary border-folio-border-subtle hover:border-folio-text-tertiary"
              )}
            >
              Paint Accent
            </button>
          )}

          <div className="folio-ui text-folio-text-tertiary">
            {realTiles.length} item{realTiles.length !== 1 ? 's' : ''}
          </div>

          {/* Add Tile Button */}
          <button
            onClick={() => setEditing({ open: true, productId: undefined, selectionId: undefined })}
            className="flex items-center space-x-2 px-3 py-2 bg-[var(--accent)] text-white folio-ui rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
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
                "group relative rounded-[20px] border shadow-sm bg-surface-ground overflow-hidden",
                paintAccentEnabled && room.paintColor
                  ? "border-folio-border-subtle" // Subtle border, not overwhelming
                  : "border-folio-border-subtle",
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
                onSaveToProject={(sel) => setSaveToProjectSelection(sel)}
                onDelete={handleDeleteSelection}
                onEnterQuote={(sel) => setQuoteEntrySelection(sel)}
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
                    className="object-contain bg-surface-ground"
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
                      {/* Pricing status indicator */}
                      {(() => {
                        const uiMeta = selection.metadata as unknown as Record<string, string> | undefined;
                        const productId = uiMeta?.productId || selection.vendorProductId;
                        const pricing = productId ? pricingData[productId] : undefined;
                        if (pricing?.status === 'RECEIVED' && pricing.unitPriceTrade != null) {
                          return (
                            <div className="text-green-300">
                              ✓ ${pricing.unitPriceTrade.toLocaleString()}
                              {pricing.leadTimeWeeks && <span className="text-white/70 ml-1">· {pricing.leadTimeWeeks} wk</span>}
                            </div>
                          );
                        }
                        if (pricing?.status === 'REQUESTED') {
                          return <div className="text-amber-300">⏳ Quote pending</div>;
                        }
                        if (pricing?.availability === 'DISCONTINUED') {
                          return <div className="text-red-300">⛔ Discontinued</div>;
                        }
                        // Fall back to selection.unitPrice if no ProjectProductPricing
                        if (selection.unitPrice) {
                          return <div>{formatPrice(selection.unitPrice)}</div>;
                        }
                        return null;
                      })()}
                      {currentOverride && (
                        <div className="text-white/70">● {currentOverride}</div>
                      )}
                      {getRoleLabel(selection.slotKey) && (
                        <div className="text-white/80 flex items-center gap-1">
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
                  "group relative rounded-[20px] border-2 border-dashed border-folio-border-subtle bg-surface-canvas opacity-60",
                  paintAccentEnabled && room.paintColor
                    ? "border-[var(--text-tertiary)]"
                    : "border-folio-border-subtle",
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
                  <div className="text-folio-text-secondary mb-4">
                    <div className={clsx("font-semibold mb-2",
                      slot.defaultSize === 'large' ? "text-lg" : slot.defaultSize === 'medium' ? "text-base" : "folio-ui"
                    )}>
                      {slot.label}
                    </div>
                    <div className="folio-meta text-folio-text-tertiary">
                      {slot.category}
                    </div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex flex-col space-y-2 w-full max-w-32">
                    <button
                      onClick={() => router.push(goShop(slot.category, projectId, room.type || room.name))}
                      className="flex items-center justify-center space-x-2 px-3 py-2 bg-[var(--accent)] text-white folio-meta rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      <FaShoppingBag className="w-3 h-3" />
                      <span>Shop</span>
                    </button>
                    <button
                      onClick={() => {
                        // Open upload flow scoped to this room/slot
                        setEditing({ open: true, productId: undefined, selectionId: undefined, slotKey: slot.key });
                      }}
                      className="flex items-center justify-center space-x-2 px-3 py-2 bg-[var(--text-secondary)] text-white folio-meta rounded-lg hover:bg-[var(--text-primary)] transition-colors"
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
          className="inline-flex items-center gap-2 px-4 py-2 folio-ui font-medium rounded-xl bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:scale-[0.99] transition"
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
        initialSlotKey={editing.slotKey}
      />

      {/* Image Replacement Modal */}
      {replacingImage.open && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setReplacingImage({ open: false })} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-ground rounded-lg shadow-xl p-6">
            <h3 className="folio-h3 mb-4">Replace Image</h3>
            <div className="space-y-4">
              <div>
                <label className="block folio-ui font-medium text-folio-text-primary mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  className="w-full border border-folio-border-subtle rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-surface-canvas"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setReplacingImage({ open: false })}
                  className="px-4 py-2 text-folio-text-primary border border-folio-border-subtle rounded-md hover:bg-surface-canvas"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // TODO: Implement image replacement
                    setReplacingImage({ open: false });
                    router.refresh();
                  }}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)]"
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
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface-ground rounded-lg shadow-xl p-6">
            <h3 className="folio-h3 mb-4">Change Role</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleRoleChange(roleChangePopover.selectionId!, '')}
                className="w-full text-left px-3 py-2 folio-ui hover:bg-surface-canvas rounded"
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
                      "w-full text-left px-3 py-2 folio-ui rounded",
                      isCurrent
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : isTaken
                          ? "bg-stone-100 text-[rgb(74,44,59)] hover:bg-stone-200"
                          : "hover:bg-surface-canvas"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{slot.label}</span>
                      {isTaken && <span className="folio-meta opacity-75">(taken)</span>}
                      {isCurrent && <span className="folio-meta opacity-75">(current)</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setRoleChangePopover({ open: false })}
                className="px-4 py-2 text-folio-text-primary border border-folio-border-subtle rounded-md hover:bg-surface-canvas"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Edit Modal */}
      {roomEditOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setRoomEditOpen(false)} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-ground rounded-lg shadow-xl p-6">
            <h3 className="folio-h3 mb-4">Edit Room</h3>
            <div className="space-y-4">
              {/* Room Name */}
              <div>
                <label className="block folio-ui font-medium text-folio-text-primary mb-1">
                  Room Name
                </label>
                <input
                  type="text"
                  value={editingRoomName}
                  onChange={(e) => setEditingRoomName(e.target.value)}
                  placeholder="e.g., Primary Bedroom"
                  className="w-full border border-folio-border-subtle rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-surface-canvas"
                  autoFocus
                />
              </div>

              {/* Room Type */}
              <div>
                <label className="block folio-ui font-medium text-folio-text-primary mb-1">
                  Room Type
                </label>
                <p className="folio-meta text-folio-text-tertiary mb-2">
                  Determines placeholder tiles. Pick a suggestion or type your own.
                </p>
                <input
                  list="room-type-suggestions"
                  value={editingRoomType}
                  onChange={(e) => setEditingRoomType(e.target.value)}
                  placeholder="e.g., Bar, Wine Cellar, Gym"
                  className="w-full border border-folio-border-subtle rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-surface-canvas"
                />
                <datalist id="room-type-suggestions">
                  {ROOM_TYPE_SUGGESTIONS.map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setRoomEditOpen(false)}
                  className="px-4 py-2 text-folio-text-primary border border-folio-border-subtle rounded-md hover:bg-surface-canvas"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRoom}
                  disabled={isSavingRoom || !editingRoomName.trim()}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingRoom ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save to Project Modal */}
      <SaveSelectionToProjectModal
        isOpen={!!saveToProjectSelection}
        onClose={() => setSaveToProjectSelection(null)}
        selection={saveToProjectSelection}
        onSuccess={() => {
          setSaveToProjectSelection(null);
          router.refresh();
        }}
      />

      <ManualQuoteEntryModal
        isOpen={!!quoteEntrySelection}
        onClose={() => setQuoteEntrySelection(null)}
        projectId={projectId}
        productId={
          (quoteEntrySelection?.metadata as unknown as Record<string, string> | undefined)?.productId
          || quoteEntrySelection?.vendorProductId
          || quoteEntrySelection?.id
          || ''
        }
        productName={quoteEntrySelection?.productName || 'Unknown'}
        vendorName={quoteEntrySelection?.vendorName || 'Unknown'}
        roomId={room.id}
        onSaved={() => {
          setQuoteEntrySelection(null);
          onPricingRefresh?.();
        }}
      />
    </div>
  );
}
