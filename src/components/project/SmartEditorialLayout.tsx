"use client";

import clsx from "clsx";
import { buildEditorialChapters, EditorialChapter } from "@/lib/editorial/buildEditorialChapters";
import { SceneShopStrip } from "@/components/project/SceneShopStrip";

export function SmartEditorialLayout({ post }: { post: any }) {
  const chapters = buildEditorialChapters(post);
  if (!chapters.length) return null;

  return (
    <div className="flex flex-col gap-16 md:gap-24">
      {chapters.map((chapter, idx) => {
        const template = chooseTemplate(chapter, idx);
        switch (template) {
          case "cinema":
            return <CinemaSpread key={chapter.id} chapter={chapter} />;
          case "textOverImage":
            return <TextOverImageSpread key={chapter.id} chapter={chapter} />;
          case "detailGrid":
            return <DetailGridSpread key={chapter.id} chapter={chapter} />;
          case "sideBySide":
          default:
            return (
              <SideBySideSpread
                key={chapter.id}
                chapter={chapter}
                flip={idx % 2 === 1}
              />
            );
        }
      })}
    </div>
  );
}

type TemplateId = "cinema" | "sideBySide" | "textOverImage" | "detailGrid";

function chooseTemplate(chapter: EditorialChapter, index: number): TemplateId {
  const bodyLength = chapter.body?.length ?? 0;
  const productCount = chapter.taggedProducts.length;

  if (index === 0 && chapter.primaryImage) return "cinema";
  if (productCount >= 4) return "detailGrid";
  if (bodyLength > 750) return "textOverImage";
  return "sideBySide";
}

/* -------------------------------------------------------------------------- */
/* TEMPLATE A: Side-by-side image + glass text (photo first)                  */
/* -------------------------------------------------------------------------- */

function SideBySideSpread({
  chapter,
  flip,
}: {
  chapter: EditorialChapter;
  flip?: boolean;
}) {
  const hasImage = !!chapter.primaryImage?.url;

  return (
    <section className="mx-auto max-w-6xl px-3 md:px-0">
      <div
        className={clsx(
          "grid gap-8 md:gap-12 items-start",
          hasImage ? "md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" : "md:grid-cols-1",
          flip && hasImage && "md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        )}
      >
        {/* IMAGE COLUMN */}
        {hasImage && (
          <div className={clsx(flip && "md:order-2")}>
            <FigureImage image={chapter.primaryImage} title={chapter.title} />
            <SceneShopStrip products={chapter.taggedProducts} />
          </div>
        )}

        {/* TEXT COLUMN */}
        <div className={clsx(hasImage && flip && "md:order-1")}>
          <GlassTextBlock chapter={chapter} variant="narrative" />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* TEMPLATE B: Text block above, wide image below                             */
/* -------------------------------------------------------------------------- */

function TextOverImageSpread({ chapter }: { chapter: EditorialChapter }) {
  return (
    <section className="mx-auto max-w-5xl px-3 md:px-0 flex flex-col gap-6">
      <GlassTextBlock chapter={chapter} variant="full" />
      {chapter.primaryImage?.url && (
        <div>
          <FigureImage image={chapter.primaryImage} title={chapter.title} />
          <SceneShopStrip products={chapter.taggedProducts} />
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* TEMPLATE C: Cinema spread (hero chapter break)                             */
/* -------------------------------------------------------------------------- */

function CinemaSpread({ chapter }: { chapter: EditorialChapter }) {
  return (
    <section className="w-full">
      {chapter.primaryImage?.url && (
        <div className="relative h-[55vh] min-h-[360px] max-h-[640px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={chapter.primaryImage.url}
            alt={chapter.title ?? ""}
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-end justify-between gap-3">
            <div className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/80">
              {chapter.title || "Project Chapter"}
            </div>
            {chapter.pullQuote && (
              <div className="max-w-md rounded-2xl bg-black/55 px-4 py-3 text-[13px] text-white/90">
                "{chapter.pullQuote}"
              </div>
            )}
          </div>
        </div>
      )}
      {chapter.body && (
        <div className="mx-auto mt-6 max-w-4xl px-3 md:px-0">
          <GlassTextBlock chapter={chapter} variant="intro" />
        </div>
      )}
      <div className="mx-auto mt-4 max-w-4xl px-3 md:px-0">
        <SceneShopStrip products={chapter.taggedProducts} />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* TEMPLATE D: Detail grid + "In the Details / Shop the Space"               */
/* -------------------------------------------------------------------------- */

function DetailGridSpread({ chapter }: { chapter: EditorialChapter }) {
  const allImages = [
    chapter.primaryImage,
    ...chapter.supportingImages,
  ].filter(Boolean);

  return (
    <section className="mx-auto max-w-6xl px-3 md:px-0 grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] items-start">
      <div className="grid grid-cols-2 gap-4 md:gap-5">
        {allImages.slice(0, 4).map((img: any, idx: number) => (
          <div
            key={img.id ?? idx}
            className={clsx(
              "overflow-hidden rounded-2xl bg-neutral-100",
              idx === 0 && "col-span-2"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={chapter.title ?? ""}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <GlassTextBlock chapter={chapter} variant="narrative" />
        <div className="rounded-3xl bg-white/75 backdrop-blur-2xl ring-1 ring-black/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">
              In the Details
            </h3>
            <span className="text-[11px] text-neutral-400">
              Shop the space
            </span>
          </div>
          <SceneShopStrip products={chapter.taggedProducts} dense />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* SHARED SUBCOMPONENTS                                                       */
/* -------------------------------------------------------------------------- */

function FigureImage({ image, title }: { image: any; title?: string | null }) {
  if (!image?.url) return null;

  return (
    <figure className="overflow-hidden rounded-3xl bg-neutral-100 shadow-[0_18px_60px_rgba(15,14,10,0.18)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={title ?? ""}
        className="h-full w-full object-cover"
      />
    </figure>
  );
}

function GlassTextBlock({
  chapter,
  variant,
}: {
  chapter: EditorialChapter;
  variant: "narrative" | "intro" | "full";
}) {
  if (!chapter.body && !chapter.title) return null;

  return (
    <div className="rounded-[28px] bg-white/75 backdrop-blur-2xl ring-1 ring-black/5 px-5 py-4 md:px-6 md:py-5 space-y-3">
      {chapter.title && (
        <h2 className="text-[13px] font-semibold tracking-[0.16em] uppercase text-neutral-500">
          {chapter.title}
        </h2>
      )}
      {chapter.body && (
        <p className="text-[13px] leading-relaxed text-neutral-800 whitespace-pre-line">
          {chapter.body}
        </p>
      )}
      {chapter.pullQuote && variant !== "intro" && (
        <div className="mt-1 border-l border-neutral-200 pl-3 text-[12px] italic text-neutral-600">
          "{chapter.pullQuote}"
        </div>
      )}
    </div>
  );
}

