'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, GripVertical, Trash2 } from 'lucide-react';

interface ProcessPhase {
  id?: string;
  name: string;
  description: string;
  order: number;
}

interface ProcessBuilderModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  initialPhases?: ProcessPhase[];
  onSuccess: () => void;
}

const DEFAULT_PHASES = [
  { name: 'Discovery', description: 'Initial consultation and project assessment', order: 0 },
  { name: 'Concept Development', description: 'Creating the design vision and mood boards', order: 1 },
  { name: 'Schematic Design', description: 'Space planning and preliminary layouts', order: 2 },
  { name: 'Design Development', description: 'Material selections and detailed specifications', order: 3 },
  { name: 'Documentation', description: 'Construction drawings and procurement lists', order: 4 },
  { name: 'Implementation', description: 'Installation and project management', order: 5 }
];

export function ProcessBuilderModal({
  open,
  onClose,
  orgId,
  initialPhases,
  onSuccess
}: ProcessBuilderModalProps) {
  const [phases, setPhases] = useState<ProcessPhase[]>(
    initialPhases?.length ? initialPhases : []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const addPhase = () => {
    setPhases([...phases, { name: '', description: '', order: phases.length }]);
  };

  const updatePhase = (index: number, field: 'name' | 'description', value: string) => {
    const updated = [...phases];
    updated[index] = { ...updated[index], [field]: value };
    setPhases(updated);
  };

  const removePhase = (index: number) => {
    setPhases(phases.filter((_, i) => i !== index).map((p, i) => ({ ...p, order: i })));
  };

  const useTemplate = () => {
    setPhases(DEFAULT_PHASES.map((p) => ({ ...p })));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const updated = [...phases];
    const [dragged] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, dragged);

    // Update order values
    updated.forEach((phase, i) => {
      phase.order = i;
    });

    setPhases(updated);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async () => {
    if (phases.length === 0) {
      setError('Please add at least one process phase');
      return;
    }

    if (phases.some((p) => !p.name.trim())) {
      setError('All phases must have a name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/orgs/${orgId}/process-phases`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phases })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save process phases');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Process phases error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Georgia, serif' }}>Design Process</DialogTitle>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Define the phases of your design process to help clients understand how you work.
          </p>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {error && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'rgb(220, 38, 38)' }}
            >
              {error}
            </div>
          )}

          {phases.length === 0 && (
            <div
              className="text-center py-8 border-2 border-dashed rounded-lg"
              style={{ borderColor: 'var(--ridge-outer)' }}
            >
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                No phases defined yet. Start from scratch or use our template.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="ghost" onClick={addPhase}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Phase
                </Button>
                <Button onClick={useTemplate}>Use Template</Button>
              </div>
            </div>
          )}

          {phases.length > 0 && (
            <div className="space-y-3">
              {phases.map((phase, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className="flex items-start gap-3 p-4 rounded-lg border transition-colors"
                  style={{
                    borderColor:
                      draggedIndex === index ? 'var(--accent)' : 'var(--ridge-outer)',
                    backgroundColor:
                      draggedIndex === index ? 'var(--bg-elevated)' : 'transparent',
                    cursor: 'grab'
                  }}
                >
                  <div className="mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium"
                    style={{ backgroundColor: 'var(--bg-elevated)' }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Phase name"
                      value={phase.name}
                      onChange={(e) => updatePhase(index, 'name', e.target.value)}
                    />
                    <Textarea
                      placeholder="Brief description (optional)"
                      value={phase.description}
                      onChange={(e) => updatePhase(index, 'description', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePhase(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {phases.length > 0 && (
            <Button variant="ghost" onClick={addPhase} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Phase
            </Button>
          )}
        </div>

        <div
          className="flex justify-end gap-3 px-6 pb-6 pt-4"
          style={{ borderTop: '1px solid var(--ridge-outer)' }}
        >
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || phases.length === 0}>
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save Process
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
