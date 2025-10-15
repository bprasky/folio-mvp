'use client';

import { useState, useTransition } from 'react';
import { deleteProjectAction } from './actions';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface DeleteProjectButtonProps {
  projectId: string;
  projectName: string;
}

export function DeleteProjectButton({ projectId, projectName }: DeleteProjectButtonProps) {
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
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        disabled={pending}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        {pending ? 'Deleting...' : 'Delete Project'}
      </button>

      <ConfirmDialog
        open={open}
        title="Delete this project?"
        description={`This will permanently delete "${projectName}" and all its related content. This action cannot be undone.`}
        confirmText={pending ? 'Deleting…' : 'Delete project'}
        confirmVariant="destructive"
        onCancel={() => setOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}







