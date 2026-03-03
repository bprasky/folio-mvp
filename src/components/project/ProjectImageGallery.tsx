"use client";

import clsx from "clsx";
import { ImageTagDots } from "@/components/project/ImageTagDots";

type ProjectImageGalleryProps = {
  project: any;
};

export function ProjectImageGallery({ project }: ProjectImageGalleryProps) {
  const images = Array.isArray(project?.images) ? project.images : [];

  if (!images.length) return null;

  // Optional: skip the very first image if it's already used as the hero at the top
  const galleryImages = images.slice(1);

  if (!galleryImages.length) return null;

  return (
    <section className="mt-10 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="folio-ui tracking-[0.18em] uppercase text-[var(--text-secondary)]">
          Project Gallery
        </h2>
        <span className="folio-meta text-[var(--text-tertiary)]">
          {galleryImages.length} photos
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {galleryImages.map((img: any, index: number) => (
          <figure
            key={img.id ?? index}
            className={clsx(
              "relative overflow-hidden rounded-[20px] bg-[var(--bg-elevated)] shadow-[0_16px_40px_rgba(15,14,10,0.16)]",
              // Let the first few images feel larger by spanning more columns on desktop
              index === 0 && "md:col-span-2 lg:col-span-3",
              index === 1 && "md:col-span-1 lg:col-span-2"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={project?.title ?? ""}
              className="h-full w-full object-cover"
            />
            <ImageTagDots image={img} />
          </figure>
        ))}
      </div>
    </section>
  );
}

