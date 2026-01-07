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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Create a Project</h2>
        <div className="grid gap-3">
          <button
            className="w-full rounded-xl border-2 border-blue-600 bg-blue-50 px-4 py-3 text-left hover:bg-blue-100 transition-colors"
            onClick={goCreate}
          >
            <div className="font-medium text-blue-900">Create Project</div>
            <div className="text-sm text-blue-700">
              Add title, optional details, then upload images and tag products.
            </div>
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button 
            className="text-sm text-gray-600 hover:text-gray-800 transition-colors" 
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
