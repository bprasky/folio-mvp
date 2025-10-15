'use client';

import { useTransition } from 'react';
import { publishProjectAction } from '@/app/actions/projects';
import { FaCheck } from 'react-icons/fa';

interface PublishButtonProps {
  projectId: string;
  onPublished?: () => void;
}

export function PublishButton({ projectId, onPublished }: PublishButtonProps) {
  const [pending, startTransition] = useTransition();

  const handlePublish = () => {
    startTransition(async () => {
      try {
        await publishProjectAction({ projectId });
        onPublished?.();
      } catch (error) {
        console.error('Failed to publish project:', error);
        alert('Failed to publish project. Please try again.');
      }
    });
  };

  return (
    <button
      onClick={handlePublish}
      disabled={pending}
      className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Publish Project"
    >
      {pending ? (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <FaCheck className="w-4 h-4" />
      )}
    </button>
  );
}




