'use client';

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { FaTimes } from 'react-icons/fa';

interface OverviewModalProps {
  open: boolean;
  onClose: () => void;
  project: any;
}

export default function OverviewModal({ open, onClose, project }: OverviewModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-xl font-semibold">Overview</DialogTitle>
            <button
              aria-label="Close"
              onClick={onClose}
              className="rounded p-1 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
            >
              <FaTimes className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Stage" value={project.stage ?? '—'} />
            <Field label="Project Type" value={project.projectType ?? '—'} />
            <Field label="Client Type" value={project.clientType ?? '—'} />
            <Field label="Budget Band" value={project.budgetBand ?? '—'} />
            <Field label="Location" value={project.city ?? 'Not specified'} />
            <Field label="Status" value={project.isPublic ? 'Published' : 'Draft'} />
            <Field label="Created" value={project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '—'} />
            <Field label="Updated" value={project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : '—'} />
          </div>

          {project.description && (
            <div className="mt-5">
              <div className="text-neutral-500 mb-1">Description</div>
              <p className="text-sm text-neutral-800 whitespace-pre-line">{project.description}</p>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-neutral-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

