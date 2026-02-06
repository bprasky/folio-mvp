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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4 text-stone-900 dark:text-stone-100">
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
            className="w-full rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors group"
            onClick={createProject}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 group-hover:bg-stone-200 dark:group-hover:bg-stone-700">
                <FolderKanban className="w-5 h-5 text-stone-600 dark:text-stone-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-stone-900 dark:text-stone-100">Create Project</div>
                <div className="text-sm text-stone-600 dark:text-stone-400">
                  Organize samples and client work
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button 
            className="text-sm text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors" 
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

