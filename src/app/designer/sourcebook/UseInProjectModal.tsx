'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface Project {
  id: string;
  title: string;
}

interface UseInProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productBrand: string | null;
  currentProjectIds: string[];
}

export default function UseInProjectModal({
  isOpen,
  onClose,
  productName,
  productBrand,
  currentProjectIds,
}: UseInProjectModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects?mine=true');
      if (res.ok) {
        const data = await res.json();
        // Filter out projects that already use this product
        const available = (data.projects || data || []).filter(
          (p: Project) => !currentProjectIds.includes(p.id)
        );
        setProjects(available);
      }
    } catch {
      // Silently handle — user can retry
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-surface rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
        <h3 className="folio-h3 text-[var(--text-primary)] mb-1">Use in Project</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {productName}{productBrand ? ` — ${productBrand}` : ''}
        </p>

        {loading ? (
          <div className="py-8 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent)]" />
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              No other projects available. This product is already in all your projects.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {projects.map(project => (
              <label
                key={project.id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedProjectId === project.id
                    ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30'
                    : 'hover:bg-[var(--bg-elevated)] border border-transparent'
                }`}
              >
                <input
                  type="radio"
                  name="project"
                  value={project.id}
                  checked={selectedProjectId === project.id}
                  onChange={() => setSelectedProjectId(project.id)}
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm text-[var(--text-primary)]">{project.title}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ridge" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!selectedProjectId || loading}
            onClick={() => {
              // Navigate to the selected project to tag the product there
              if (selectedProjectId) {
                window.location.href = `/designer/projects/${selectedProjectId}`;
              }
            }}
          >
            Go to Project
          </Button>
        </div>
      </div>
    </div>
  );
}
