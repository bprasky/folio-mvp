"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { trackSaveToRoom } from "@/lib/metrics";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string;
  eventId?: string;
  subeventId?: string;
  userId: string;
};

type Project = { id: string; name: string };
type Room = { id: string; name: string };

export function QuickAddToRoom({ open, onOpenChange, productId, eventId, subeventId, userId }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [newRoom, setNewRoom] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    console.log('QuickAddToRoom: Fetching projects for userId:', userId);
    fetch("/api/designer/projects")
      .then(r => {
        console.log('QuickAddToRoom: Projects response status:', r.status);
        return r.json();
      })
      .then((d) => {
        console.log('QuickAddToRoom: Projects data:', d);
        console.log('QuickAddToRoom: Projects array length:', Array.isArray(d) ? d.length : 'Not an array');
        if (Array.isArray(d)) {
          console.log('QuickAddToRoom: First project:', d[0]);
        }
        setProjects(Array.isArray(d) ? d : []);
      })
      .catch(e => {
        console.error('QuickAddToRoom: Error fetching projects:', e);
      });
  }, [open, userId]);

  useEffect(() => {
    if (!projectId) { setRooms([]); setRoomId(""); return; }
    console.log('QuickAddToRoom: Fetching rooms for projectId:', projectId);
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/designer/projects/${projectId}/rooms`, { cache: "no-store" });
        console.log('QuickAddToRoom: Rooms response status:', res.status);
        const data = await res.json();
        console.log('QuickAddToRoom: Rooms data:', data);
        if (active) setRooms(Array.isArray(data.rooms) ? data.rooms : []);
      } catch (e) {
        console.error("Failed to fetch rooms", e);
        if (active) setRooms([]);
      }
    })();
    return () => { active = false };
  }, [projectId]);

  const createRoom = async () => {
    if (!projectId || !newRoom.trim()) return;
    const res = await fetch(`/api/designer/projects/${projectId}/rooms`, {
      method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ name: newRoom.trim() })
    });
    const room = await res.json();
    setRooms(prev => [...prev, room]);
    setRoomId(room.id);
    setNewRoom("");
  };

  const save = async () => {
    if (!projectId || !roomId) return;
    
    setError(null);
    setSaving(true);
    
    try {
      const payload = { productId, eventId, subeventId, projectId, roomId, userId, ts: new Date().toISOString() };
      console.log('QuickAddToRoom: Saving product:', payload);
      
      const response = await fetch("/api/designer/save-to-room", { 
        method:"POST", 
        headers:{ "Content-Type":"application/json" }, 
        body: JSON.stringify(payload) 
      });
      
      console.log('QuickAddToRoom: Save response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('QuickAddToRoom: Save failed:', error);
        setError(error.error || 'Failed to save product');
        setSaving(false);
        return;
      }
      
      const result = await response.json();
      console.log('QuickAddToRoom: Saved successfully:', result);
      trackSaveToRoom(payload);
      setSaving(false);
      onOpenChange(false);
    } catch (err) {
      console.error('QuickAddToRoom: Save error:', err);
      setError('Failed to save product. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl bg-surface-ground backdrop-blur-xl ring-1 ring-white/10 text-folio-text-primary shadow-2xl">
        <DialogHeader>
          <DialogTitle>Save to project & room</DialogTitle>
        </DialogHeader>

        {/* Project */}
        <div className="space-y-2">
          <Label>Project</Label>
          <Select value={projectId} onValueChange={(v) => {
            console.log('QuickAddToRoom: Project selected:', v);
            setProjectId(v);
          }}>
            <SelectTrigger className="bg-white/10 text-white placeholder:text-white/50 ring-1 ring-white/20 focus:ring-white/40 border-0">
              <SelectValue>{projectId ? projects.find(p => p.id === projectId)?.name || "Select a project" : "Select a project"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => {
                console.log('QuickAddToRoom: Rendering project:', p);
                return <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Room */}
        <div className="space-y-2">
          <Label>Room</Label>
          <Select value={roomId} onValueChange={(v) => {
            console.log('QuickAddToRoom: Room selected:', v);
            setRoomId(v);
          }}>
            <SelectTrigger className="bg-white/10 text-white placeholder:text-white/50 ring-1 ring-white/20 focus:ring-white/40 border-0">
              <SelectValue>{roomId ? rooms.find(r => r.id === roomId)?.name || (projectId ? "Select a room" : "Choose a project first") : (projectId ? "Select a room" : "Choose a project first")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input placeholder="Add new room (e.g., Study)" value={newRoom} onChange={(e)=>setNewRoom(e.target.value)} disabled={!projectId} className="bg-white/10 text-white placeholder:text-white/50 ring-1 ring-white/20 focus:ring-white/40 border-0 rounded-xl px-3 py-2"/>
            <Button variant="secondary" onClick={createRoom} disabled={!projectId || !newRoom.trim()} className="bg-white/10 hover:bg-white/20 text-white">+ Add</Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button 
            variant="outline" 
            onClick={()=>onOpenChange(false)} 
            disabled={saving}
            className="bg-white/10 hover:bg-white/20 text-white"
          >
            Cancel
          </Button>
          <Button 
            onClick={save} 
            disabled={!projectId || !roomId || saving} 
            className="bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}