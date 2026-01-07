"use client";

import { RichArticle } from "@/components/posting/preview/RichArticle";
import type { ProjectModule } from "@prisma/client";
import { LongVideoModule } from "./modules/LongVideoModule";
import { StoriesRail } from "./modules/StoriesRail";
import { GalleryGrid } from "./modules/GalleryGrid";
import { BoardsGrid } from "./modules/BoardsGrid";
import { TimelineList } from "./modules/TimelineList";

type Props = {
  post: any;                    // your existing post type
  modules: ProjectModule[];
  article?: any;                // RichArticle props
  heroImage?: { id: string; url: string } | null;
  tags?: Array<{ id: string; productName: string; productId?: string }>;
  author?: { name?: string };
  projectTitle?: string;
  images?: Array<{ id: string; url: string; caption?: string }>;
};

export function ProjectMediaHub({ post, modules, article, heroImage, tags, author, projectTitle, images }: Props) {
  const longFilm   = modules.find((m) => m.type === "LONG_VIDEO" && m.isPrimary);
  const shortClips = modules.filter((m) => m.type === "SHORT_VIDEO" || m.type === "STORY");
  const galleries  = modules.filter((m) => m.type === "GALLERY");
  const boards     = modules.filter((m) => m.type === "BOARD");
  const timelines  = modules.filter((m) => m.type === "TIMELINE");

  // Get article blocks from post if not provided
  const articleBlocks = article || post?.expandedBlocks || {};

  return (
    <article className="space-y-10">
      {/* 1. Long-form Film hero (if present) */}
      {longFilm ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
            Project Film
          </h2>
          <LongVideoModule module={longFilm} />
        </section>
      ) : null}

      {/* 2. Existing editorial article */}
      <section>
        <RichArticle 
          article={articleBlocks}
          heroImage={heroImage}
          tags={tags}
          author={author}
          projectTitle={projectTitle}
          images={images}
        />
      </section>

      {/* 3. Stories & Updates rail */}
      {shortClips.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
              Stories & Updates
            </h2>
            <span className="text-[11px] text-neutral-400">
              Follow how this project evolves over time.
            </span>
          </div>
          <StoriesRail modules={shortClips} />
        </section>
      ) : null}

      {/* 4. Additional galleries */}
      {galleries.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
            Additional Galleries
          </h2>
          <GalleryGrid modules={galleries} />
        </section>
      ) : null}

      {/* 5. Boards / selections */}
      {boards.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
            Boards & Selections
          </h2>
          <BoardsGrid modules={boards} />
        </section>
      ) : null}

      {/* 6. Timeline / logbook (optional, text-heavy) */}
      {timelines.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-neutral-700 uppercase">
            Timeline
          </h2>
          <TimelineList modules={timelines} />
        </section>
      ) : null}
    </article>
  );
}

