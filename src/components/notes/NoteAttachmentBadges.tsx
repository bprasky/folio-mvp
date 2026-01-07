'use client';

import React from 'react';
import { FaTag, FaDoorOpen, FaFolder } from 'react-icons/fa';

interface Attachment {
  id: string;
  project?: { id: string; title: string } | null;
  room?: { id: string; name: string } | null;
  productTag?: {
    id: string;
    product?: { id: string; name: string } | null;
  } | null;
}

interface NoteAttachmentBadgesProps {
  attachments: Attachment[];
  onRemove?: (attachmentId: string) => void;
}

export default function NoteAttachmentBadges({
  attachments,
  onRemove,
}: NoteAttachmentBadgesProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((attachment) => {
        if (attachment.room) {
          return (
            <span
              key={attachment.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
            >
              <FaDoorOpen />
              {attachment.room.name}
              {onRemove && (
                <button
                  onClick={() => onRemove(attachment.id)}
                  className="ml-1 hover:text-blue-900"
                >
                  ×
                </button>
              )}
            </span>
          );
        }

        if (attachment.productTag) {
          return (
            <span
              key={attachment.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full"
            >
              <FaTag />
              {attachment.productTag.product?.name || 'Product'}
              {onRemove && (
                <button
                  onClick={() => onRemove(attachment.id)}
                  className="ml-1 hover:text-green-900"
                >
                  ×
                </button>
              )}
            </span>
          );
        }

        if (attachment.project) {
          return (
            <span
              key={attachment.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
            >
              <FaFolder />
              {attachment.project.title}
              {onRemove && (
                <button
                  onClick={() => onRemove(attachment.id)}
                  className="ml-1 hover:text-gray-900"
                >
                  ×
                </button>
              )}
            </span>
          );
        }

        return null;
      })}
    </div>
  );
}








