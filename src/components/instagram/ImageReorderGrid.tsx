/**
 * Drag-and-drop image reordering grid using @dnd-kit
 */

'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Image from 'next/image';

interface ProjectImage {
  id: string;
  url: string;
  name?: string | null;
}

interface ImageReorderGridProps {
  images: ProjectImage[];
  onReorder: (orderedIds: string[]) => void;
}

interface SortableImageItemProps {
  image: ProjectImage;
  index: number;
}

function SortableImageItem({ image, index }: SortableImageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-all cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {image.url ? (
        <>
          <Image
            src={image.url}
            alt={image.name || 'Project image'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 33vw"
            unoptimized
            onError={(e) => {
              console.error('[ImageReorderGrid] Failed to load image:', image.url, image);
            }}
          />
          {/* Fallback img tag for debugging */}
          <img
            src={image.url}
            alt={image.name || 'Project image'}
            className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
            onError={(e) => {
              console.error('[ImageReorderGrid] img tag also failed:', image.url);
              const target = e.target as HTMLImageElement;
              target.parentElement?.classList.add('bg-red-100');
            }}
          />
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          No image URL
        </div>
      )}
      <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-medium">
        {index + 1}
      </div>
      {isDragging && (
        <div className="absolute inset-0 bg-[var(--accent)]/20 flex items-center justify-center">
          <div className="text-[var(--accent)] font-semibold">Moving...</div>
        </div>
      )}
    </div>
  );
}

export default function ImageReorderGrid({ images, onReorder }: ImageReorderGridProps) {
  const [items, setItems] = useState(images);

  // Sync items when images prop changes
  useEffect(() => {
    if (images.length > 0) {
      console.log('[ImageReorderGrid] Setting items from images:', images.length);
      setItems(images);
    } else {
      console.warn('[ImageReorderGrid] No images provided');
    }
  }, [images]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setItems((items: ProjectImage[]) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        onReorder(newItems.map((img: ProjectImage) => img.id));
        return newItems;
      });
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No images available for this project.</p>
        <p className="text-sm mt-2">Upload images to the project first.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((img) => img.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((image, index) => (
            <SortableImageItem key={image.id} image={image} index={index} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

