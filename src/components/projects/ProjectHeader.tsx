'use client';

import { useState, useTransition } from 'react';
import { deleteProjectAction } from '@/app/project/[id]/actions';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface ProjectHeaderProps {
  projectId: string;
  title: string;
  subtitle?: string;
}

export function ProjectHeader({ projectId, title, subtitle }: ProjectHeaderProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteProjectAction({ projectId });
        // redirect happens in server action
      } catch (error) {
        console.error('Failed to delete project:', error);
        // You could add error handling here if needed
      }
    });
  };

  return (
    <header className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
        {subtitle ? <p className="text-sm text-neutral-600">{subtitle}</p> : null}
      </div>

      <div className="flex items-center gap-2">
        {/* Delete button - quiet but accessible */}
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-2 text-red-600 hover:text-red-700 rounded-md border border-transparent hover:border-red-200 transition-colors"
        >
          Delete
        </button>

        {open && (
          <ConfirmDialog
            open={open}
            title="Delete this project?"
            description="This will permanently delete the project and its related content. This action cannot be undone."
            confirmText={pending ? 'Deleting…' : 'Delete project'}
            confirmVariant="destructive"
            onCancel={() => setOpen(false)}
            onConfirm={handleDelete}
          />
        )}
      </div>
    </header>
  );
}







