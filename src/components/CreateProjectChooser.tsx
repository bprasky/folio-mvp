'use client';
import { useRouter } from 'next/navigation';

export default function CreateProjectChooser({
  onClose,
}: { onClose: () => void }) {
  const router = useRouter();

  const goCreate = () => {
    // Unified flow: single form with optional advanced details → Media tab
    router.push('/designer/create');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-backdrop">
      <div className="bg-surface-canvas rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Create a Project</h2>
        <div className="grid gap-3">
          <button
            className="w-full rounded-xl border-2 border-[var(--accent)] bg-[var(--accent)]/5 px-4 py-3 text-left hover:bg-[var(--accent)]/10 transition-colors"
            onClick={goCreate}
          >
            <div className="font-medium text-blue-900">Create Project</div>
            <div className="text-sm text-[var(--accent-hover)]">
              Add title, optional details, then upload images and tag products.
            </div>
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button 
            className="text-sm text-folio-text-secondary hover:text-folio-text-primary transition-colors" 
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
