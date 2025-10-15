'use client'
import { useState, useEffect } from 'react'

type SelectionPayload = {
  productName: string
  vendorName: string
  vendorOrgId: string | null
  sku?: string
  finish?: string
  quantity?: number
  notes?: string
  price?: number
  leadTime?: number
  imageUrl?: string
  roomId?: string
}

type SelectionEditorProps = {
  mode: "add" | "edit";
  projectId: string;
  initial?: Partial<SelectionPayload>;
  onSaved(id: string): void;
  onCancel(): void;
  context: "vendor" | "designer";
  vendorCtx?: { vendorOrgId: string; vendor: { id: string; name: string; description?: string } } | null;
};

const defaults: SelectionPayload = {
  productName: '',
  vendorName: '',
  vendorOrgId: null,
  sku: '',
  finish: '',
  quantity: 1,
  notes: '',
  price: undefined,
  leadTime: undefined,
  imageUrl: '',
  roomId: undefined,
}

export default function SelectionEditor(props: SelectionEditorProps) {
  const { context, vendorCtx, mode, projectId, initial, onSaved, onCancel } = props;

  // compute initial form state
  const [form, setForm] = useState<SelectionPayload>({
    ...defaults,
    ...initial,
    // if vendor, stamp name and lock field
    vendorOrgId: vendorCtx?.vendorOrgId ?? initial?.vendorOrgId ?? null,
    vendorName: vendorCtx?.vendor?.name ?? initial?.vendorName ?? "",
  });

  const vendorLocked = context === "vendor" && !!vendorCtx?.vendorOrgId;

  // Room management state
  const [rooms, setRooms] = useState<Array<{id:string; name:string}>>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initial?.roomId || "");
  const [newRoomName, setNewRoomName] = useState<string>("");

  // Load rooms on mount
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/vendor/projects/${projectId}/rooms`, { credentials: "include", cache: "no-store" })
      .then(r => r.json())
      .then(d => setRooms(Array.isArray(d.rooms) ? d.rooms : []))
      .catch(() => setRooms([]));
  }, [projectId]);

  async function createRoomIfNeeded(): Promise<string | null> {
    const name = newRoomName.trim();
    if (!name) return selectedRoomId || null;
    const res = await fetch(`/api/vendor/projects/${projectId}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok || !data?.room?.id) throw new Error(data?.error || "Room create failed");
    // update local list & return id
    setRooms(prev => [...prev, { id: data.room.id, name }]);
    return data.room.id;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (mode === "add") {
        // Create room if needed, then save spec
        const roomId = await createRoomIfNeeded();
        const payload = { ...form, roomId: roomId || undefined };
        const result = await fetch(`/api/vendor/projects/${projectId}/selections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        
        if (result.ok) {
          const data = await result.json();
          onSaved(data.selection?.id || data.id);
        } else {
          const errorData = await result.json();
          throw new Error(errorData?.error || "Failed to save spec");
        }
      } else {
        // Handle edit mode
        onSaved('updated');
      }
    } catch (error: any) {
      console.error('Error saving selection:', error);
      alert(error.message || "Failed to save");
    }
  };

  const hydrateFromUrl = (meta: any) => {
    setForm(f => ({
      ...f,
      ...meta,
      vendorOrgId: f.vendorOrgId || vendorCtx?.vendorOrgId || null,
      vendorName: vendorCtx?.vendor?.name || f.vendorName || "",
    }));
  };

  return (
    <div className="space-y-6">
      {/* Vendor badge (locked in vendor mode) */}
      {vendorLocked ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="px-2 py-1 rounded-full border bg-blue-50 text-blue-700">
            {vendorCtx!.vendor.name}
          </span>
          <span>•</span>
          <span className="italic">You're sending as this vendor</span>
        </div>
      ) : (
        /* Designer mode: show selectable Vendor field (catalog source) */
        <div className="space-y-2">
          <label className="block text-sm font-medium">Vendor</label>
          <input
            type="text"
            value={form.vendorName}
            onChange={(e) => setForm(f => ({ ...f, vendorName: e.target.value }))}
            placeholder="Search vendors..."
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
      )}

      {/* Product Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Product Name *</label>
          <input
            type="text"
            value={form.productName}
            onChange={(e) => setForm(f => ({ ...f, productName: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">SKU</label>
          <input
            type="text"
            value={form.sku || ''}
            onChange={(e) => setForm(f => ({ ...f, sku: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Finish</label>
          <input
            type="text"
            value={form.finish || ''}
            onChange={(e) => setForm(f => ({ ...f, finish: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Quantity</label>
          <input
            type="number"
            min="1"
            value={form.quantity || 1}
            onChange={(e) => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
      </div>

      {/* Price and Lead Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Price</label>
          <input
            type="number"
            step="0.01"
            value={form.price || ''}
            onChange={(e) => setForm(f => ({ ...f, price: parseFloat(e.target.value) || undefined }))}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Lead Time (days)</label>
          <input
            type="number"
            value={form.leadTime || ''}
            onChange={(e) => setForm(f => ({ ...f, leadTime: parseInt(e.target.value) || undefined }))}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          value={form.notes || ''}
          onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={3}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      {/* Image URL */}
      <div>
        <label className="block text-sm font-medium mb-1">Image URL</label>
        <input
          type="url"
          value={form.imageUrl || ''}
          onChange={(e) => setForm(f => ({ ...f, imageUrl: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      {/* Room Selection */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Room</label>
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Select existing room...</option>
            {rooms.map(room => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Or create new room</label>
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Enter new room name..."
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {mode === "add" ? "Add Selection" : "Update Selection"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
