'use client';
import { useRouter } from 'next/navigation';

export default function CreateProjectChooser({
  onClose,
}: { onClose: () => void }) {
  const router = useRouter();

  const goFolder = () => {
    router.push('/designer/create?intent=folder');
    onClose();
  };

  const goPublishNow = () => {
    router.push('/designer/create?intent=publish_now');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">What are you creating?</h2>
        <div className="grid gap-3">
          <button
            className="w-full rounded-xl border px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            onClick={goFolder}
          >
            <div className="font-medium">Project Folder</div>
            <div className="text-sm text-gray-600">
              Build rooms, upload CAD/specs, and publish later.
            </div>
          </button>

          <button
            className="w-full rounded-xl border px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            onClick={goPublishNow}
          >
            <div className="font-medium">Publish Now</div>
            <div className="text-sm text-gray-600">
              Upload images, tag products, and publish to the feed.
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
