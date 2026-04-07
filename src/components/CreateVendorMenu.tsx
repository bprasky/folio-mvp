'use client';
import { useRouter } from 'next/navigation';
import { Plus, Package, FolderKanban } from 'lucide-react';

export default function CreateVendorMenu({
  onClose,
}: { onClose: () => void }) {
  const router = useRouter();

  const addProduct = () => {
    router.push('/vendor/products/new');
    onClose();
  };

  const createProject = () => {
    router.push('/vendor/create-project');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-backdrop">
      <div className="bg-surface-canvas dark:bg-surface-canvas rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4 text-folio-text-primary dark:text-folio-text-tertiary">
          Create New
        </h2>
        <div className="grid gap-3">
          {/* Add Product - Primary action for vendors */}
          <button
            className="w-full rounded-xl border-2 border-[var(--accent)] bg-[var(--accent)]/5 dark:bg-blue-950 px-4 py-3 text-left hover:bg-[var(--accent)]/10 dark:hover:bg-blue-900 transition-colors group"
            onClick={addProduct}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--accent)]/10 dark:bg-blue-900 group-hover:bg-blue-200 dark:group-hover:bg-blue-800">
                <Package className="w-5 h-5 text-[var(--accent)] dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-blue-900 dark:text-blue-100">Add Product</div>
                <div className="text-sm text-[var(--accent-hover)] dark:text-blue-300">
                  Scrape from URL or manual entry with media upload
                </div>
              </div>
            </div>
          </button>

          {/* Create Project */}
          <button
            className="w-full rounded-xl border border-folio-border-subtle dark:border-folio-border-subtle px-4 py-3 text-left hover:bg-surface-ground dark:hover:bg-stone-800 transition-colors group"
            onClick={createProject}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-surface-elevated dark:bg-surface-elevated group-hover:bg-surface-elevated dark:group-hover:bg-stone-700">
                <FolderKanban className="w-5 h-5 text-folio-text-secondary dark:text-folio-text-tertiary" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-folio-text-primary dark:text-folio-text-tertiary">Create Project</div>
                <div className="text-sm text-folio-text-secondary dark:text-folio-text-tertiary">
                  Organize samples and client work
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button 
            className="text-sm text-folio-text-secondary dark:text-folio-text-tertiary hover:text-folio-text-primary dark:hover:text-folio-text-tertiary transition-colors" 
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

