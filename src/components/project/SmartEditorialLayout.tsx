"use client";

import clsx from "clsx";
import { buildEditorialChapters, EditorialChapter } from "@/lib/editorial/buildEditorialChapters";
import { SceneShopStrip } from "@/components/project/SceneShopStrip";
import { TaggedImage } from "@/components/project/interaction/TaggedImage";
import { formatRoomName } from "@/lib/utils/formatRoomName";
import { getSelectedPullQuoteText } from "@/lib/posting/schemas";

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
          <RidgeTextBlock chapter={chapter} variant="narrative" />
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
      <RidgeTextBlock chapter={chapter} variant="full" />
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
        <div className="relative ridge-card ridge-card-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={chapter.primaryImage.url}
            alt={chapter.title ?? ""}
            className="w-full h-auto"
          />
          <TaggedImage image={chapter.primaryImage} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-end justify-between gap-3">
            <div className="rounded-full bg-surface-canvas/90 backdrop-blur-sm px-3 py-1 folio-meta uppercase tracking-[0.18em] text-folio-text-secondary">
              {(chapter.title ? formatRoomName(chapter.title) : null) || "Project Chapter"}
            </div>
            {getSelectedPullQuoteText(chapter.pullQuote) && (
              <div className="max-w-md ridge-card px-4 py-3 folio-body">
                "{getSelectedPullQuoteText(chapter.pullQuote)}"
              </div>
            )}
          </div>
        </div>
      )}
      {chapter.body && (
        <div className="mx-auto mt-6 max-w-4xl px-3 md:px-0">
          <RidgeTextBlock chapter={chapter} variant="intro" />
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
      <div className="grid grid-cols-2 gap-3">
        {allImages.slice(0, 4).map((img: any, idx: number) => (
          <div
            key={img.id ?? idx}
            className={clsx(
              "relative overflow-hidden ridge-card",
              idx === 0 && "col-span-2"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={chapter.title ?? ""}
              className="w-full h-auto"
            />
            <TaggedImage image={img} />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <RidgeTextBlock chapter={chapter} variant="narrative" />
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="folio-meta uppercase tracking-[0.18em] text-folio-text-secondary">
              In the Details
            </h3>
            <span className="folio-meta text-folio-text-tertiary">
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
    <figure className="relative overflow-hidden ridge-card ridge-card-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={title ?? ""}
        className="w-full h-auto"
      />
      <TaggedImage image={image} />
    </figure>
  );
}

function RidgeTextBlock({
  chapter,
  variant,
}: {
  chapter: EditorialChapter;
  variant: "narrative" | "intro" | "full";
}) {
  if (!chapter.body && !chapter.title) return null;

  return (
    <div className="px-5 py-4 md:px-6 md:py-5 space-y-3">
      {chapter.title && (
        <h2 className="folio-meta uppercase tracking-[0.16em] text-folio-text-secondary">
          {formatRoomName(chapter.title)}
        </h2>
      )}
      {chapter.body && (
        <p className="folio-body whitespace-pre-line">
          {chapter.body}
        </p>
      )}
      {getSelectedPullQuoteText(chapter.pullQuote) && variant !== "intro" && (
        <div className="mt-1 border-l-2 border-[var(--accent)] pl-3 folio-quote text-folio-text-secondary">
          "{getSelectedPullQuoteText(chapter.pullQuote)}"
        </div>
      )}
    </div>
  );
}
