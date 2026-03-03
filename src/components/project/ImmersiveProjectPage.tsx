"use client";

import { useMemo } from "react";
import { SmartEditorialLayout } from "@/components/project/SmartEditorialLayout";
import { ProjectAiFilmPanel } from "@/components/project/ProjectAiFilmPanel";
import { CreditsSection } from "@/components/project/CreditsSection";
import { ProductBank } from "@/components/project/ProductBank";
import { ProjectImageGallery } from "@/components/project/ProjectImageGallery";
import { ImageTagDots } from "@/components/project/ImageTagDots";
import { titleCase } from "@/lib/utils";
import { getMonographUrl } from "@/lib/utils/getMonographUrl";

type MediaModule = {
  id: string;
  type: "LONG_VIDEO" | string;
  title: string | null;
  description: string | null;
  media: any;
  publishedAt: string | Date | null;
  isAiCompiled?: boolean | null;
};

type Props = {
  post: any;                 // existing post shape (ProjectPost + project + expandedBlocks)
  modules: MediaModule[];
};

export function ImmersiveProjectPage({ post, modules }: Props) {
  const projectImages: { url: string }[] =
    post?.project?.images?.length ? post.project.images : (post?.leadImages || []);

  const backgroundImageUrls = useMemo(
    () => projectImages.slice(0, 4).map((img: any) => img.url).filter(Boolean),
    [projectImages]
  );

  // const aiFilm =
  //   modules.find((m) => m.type === "LONG_VIDEO" && m.isAiCompiled) ||
  //   modules.find((m) => m.type === "LONG_VIDEO");

  return (
    <div className="relative min-h-screen">
      <BackgroundCanvas images={backgroundImageUrls} />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,_rgba(255,255,255,0.85),_rgba(255,255,255,0.98))]" />

      {/* MAIN CONTENT */}
      <div className="relative z-10 px-3 py-8 md:px-6 md:py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">
          {/* DESIGNER BADGE ROW */}
          <div className="flex items-center justify-between gap-4">
            <DesignerProjectBadge post={post} />
          </div>

          {/* HERO IMAGE */}
          {projectImages[0]?.url && (
            <figure className="relative overflow-hidden rounded-[20px] ridge-card ridge-card-lg shadow-[0_18px_60px_rgba(15,14,10,0.18)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={projectImages[0].url}
                alt={post.project?.title ?? ""}
                className="h-full w-full object-cover"
              />
              <ImageTagDots image={projectImages[0]} />
            </figure>
          )}

          {/* AI PROJECT FILM — hidden until AI editor is implemented */}
          {/* <ProjectAiFilmPanel module={aiFilm} project={post.project} /> */}

          {/* SMART EDITORIAL LAYOUT (CHAPTERS A–D) */}
          <SmartEditorialLayout post={post} />

          {/* GALLERY / PRODUCT BANK / CREDITS */}
          <div className="mt-8 flex flex-col gap-12">
            <ProjectImageGallery project={post.project} />
            <ProductBank
              post={post}
              supplementalQuotes={post.supplementalQuotes}
            />
            <CreditsSection post={post} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BackgroundCanvas({ images }: { images: string[] }) {
  if (!images?.length) return null;
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[0]}
          alt=""
          className="h-full w-full object-cover scale-[1.04] opacity-80"
        />
      </div>
    </div>
  );
}

function DesignerProjectBadge({ post }: { post: any }) {
  const designer = post.project?.designer;
  const name = titleCase(designer?.studio || designer?.name || "Designer");
  const logoUrl = designer?.profileImage;

  return (
    <a
      href={designer?.name ? getMonographUrl(designer) : "#"}
      className="ridge-card px-4 py-3 flex items-center gap-3 hover:shadow-lg transition-all"
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={name}
          className="h-10 w-10 rounded-full object-cover ring-1 ring-[var(--ridge-outer)]"
        />
      ) : (
        <div className="h-10 w-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[11px]">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex flex-col">
        <span className="folio-meta uppercase tracking-[0.16em]">Designer</span>
        <span className="folio-ui text-[var(--text-primary)] line-clamp-2">
          {name}
        </span>
        <span className="folio-meta line-clamp-1">
          {post.project?.title}
        </span>
      </div>
    </a>
  );
}

