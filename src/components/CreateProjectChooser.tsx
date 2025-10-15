'use client';
import { useRouter } from 'next/navigation';

export default function CreateProjectChooser({
  onClose,
}: { onClose: () => void }) {
  const router = useRouter();

  const goPublishNow = () => {
    // Canonical flow: simple create → media/tagging
    router.push('/designer/create?intent=publish_now&onboard=1');
    onClose();
  };

  const goFolder = () => {
    // Advanced flow: full form with project details
    router.push('/designer/create?intent=folder');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Create a Project</h2>
        <div className="grid gap-3">
          {/* Canonical flow first */}
          <button
            className="w-full rounded-xl border-2 border-blue-600 bg-blue-50 px-4 py-3 text-left hover:bg-blue-100 transition-colors"
            onClick={goPublishNow}
          >
            <div className="font-medium text-blue-900">Quick Create</div>
            <div className="text-sm text-blue-700">
              Add title, upload images, tag products, and publish.
            </div>
          </button>

          {/* Advanced flow */}
          <button
            className="w-full rounded-xl border px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            onClick={goFolder}
          >
            <div className="font-medium">Detailed Setup</div>
            <div className="text-sm text-gray-600">
              Full project form with budget, location, and stage details.
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
