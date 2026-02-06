"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VendorProjectCreator(props: any) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [rooms, setRooms] = useState<string[]>([]);
  const [newRoom, setNewRoom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRoom = () => {
    const r = newRoom.trim();
    if (!r) return;
    setRooms(prev => [...prev, r]);
    setNewRoom("");
  };
  const removeRoom = (idx: number) => {
    setRooms(prev => prev.filter((_, i) => i !== idx));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a project name.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/vendor/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: trimmed,
          note,
          initialRooms: rooms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Create failed");
      if (!data?.project?.id) throw new Error("No project id returned");

      // Navigate to vendor project page
      router.push(`/vendor/project/${data.project.id}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Create New Project</h1>
        <p className="text-[var(--text-secondary)]">Start a new project and add rooms to organize your work.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Project name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Smith Residence"
            className="mt-1 w-full rounded-md border border-[var(--ridge-outer)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Rooms (optional)</label>
          <div className="flex gap-2 mt-1">
            <input
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              placeholder="e.g., Kitchen"
              className="flex-1 rounded-md border border-[var(--ridge-outer)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRoom())}
            />
            <button 
              type="button" 
              onClick={addRoom} 
              className="rounded-md border border-[var(--ridge-outer)] px-4 py-2 hover:bg-[var(--bg-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              Add
            </button>
          </div>
          {!!rooms.length && (
            <ul className="mt-2 space-y-1">
              {rooms.map((r, i) => (
                <li key={`${r}-${i}`} className="flex items-center justify-between text-sm bg-[var(--bg-elevated)] px-3 py-2 rounded">
                  <span>{r}</span>
                  <button 
                    type="button" 
                    onClick={() => removeRoom(i)} 
                    className="text-xs text-red-600 hover:text-red-800 underline"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Notes (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Context for the designer"
            className="mt-1 w-full rounded-md border border-[var(--ridge-outer)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg px-6 py-2 bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:bg-[var(--text-tertiary)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {submitting ? "Creating…" : "Create Project"}
          </button>
          <span className="text-xs text-[var(--text-secondary)]">
            You'll add products and hand off after this step.
          </span>
        </div>
      </form>
    </div>
  );
}