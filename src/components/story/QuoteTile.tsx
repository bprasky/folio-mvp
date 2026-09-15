"use client";

// QuoteTile — Room pull quote that doubles as the expand affordance.
// Collapsed: big italic pull quote in the headline font, no glass card,
// chevron-down underneath signals "click for the full narrative."
// Expanded: pull quote is replaced in place by the room's editorial
// narrative (the quote came from the narrative anyway, so nothing is lost).
// Layout-wise the tile stays in its own grid column so the photo column
// doesn't reflow.

import { useRef, useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useStoryEdit, StoryEditRegion } from "./StoryEditContext";
import { PullQuotePicker } from "./PullQuotePicker";
import EditableParagraph from "@/components/posting/editing/EditableParagraph";
import SectionFeedback from "@/components/posting/editing/SectionFeedback";
import type { PullQuoteSelection } from "@/lib/posting/schemas";
import { getSelectedRoomLineText } from "@/lib/posting/schemas";
import { articleFolioLines } from "@/lib/posting/folioLines";

interface QuoteTileProps {
  roomLabel: string;
  pullQuote: string | null;
  attribution: string;
  productCount: number;
  editorialTeaser?: string | null;
  editorialNarrative?: string | null;
  /** The narrative still addressable per paragraph — required to edit in place. */
  editorialParagraphs?: string[];
  /** Index into galleryChapters. Not the tile's position. */
  chapterIndex?: number;
  /** Raw pull quote value (with its alternatives) for the owner's picker. */
  pullQuoteSelection?: string | PullQuoteSelection | null;
  onClick: () => void;
  isExpanded: boolean;
  wide?: boolean;
  reducedMotion?: boolean;
}

export function QuoteTile({
  roomLabel,
  pullQuote,
  attribution,
  productCount,
  editorialTeaser,
  editorialNarrative,
  editorialParagraphs,
  chapterIndex,
  pullQuoteSelection,
  onClick,
  isExpanded,
  wide = false,
  reducedMotion = false,
}: QuoteTileProps) {
  const ref = useRef<HTMLDivElement>(null);
  // null on the published article — every branch below then behaves as before.
  const edit = useStoryEdit();
  const editable = !!edit && typeof chapterIndex === "number";
  const storedSelection = pullQuoteSelection ?? pullQuote;
  const fallbackLines = getSelectedRoomLineText(storedSelection) ? []
    : articleFolioLines(roomLabel, editorialParagraphs ?? (editorialNarrative ? [editorialNarrative] : []));
  const displaySelection: string | PullQuoteSelection | null | undefined = fallbackLines.length
    ? { selected: null, alternatives: [], authorship: 'folio', folio: { selected: fallbackLines[0], alternatives: fallbackLines } }
    : storedSelection;
  const displayQuote = getSelectedRoomLineText(displaySelection);
  const folioAuthored = !!displaySelection && typeof displaySelection !== "string" && displaySelection.authorship === "folio";
  const [revealed, setRevealed] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const stagger = (delayMs: number) =>
    reducedMotion
      ? {}
      : {
          transition: `opacity 400ms ease ${delayMs}ms, transform 400ms ease ${delayMs}ms`,
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0)" : `translateY(12px)`,
        };

  // A reader opens a room to read it. An owner is here to WRITE it — making them
  // expand every room to reach their own prose is the same tax the Edit/Preview
  // toggle was, rebuilt one tile at a time.
  const showNarrative = editable ? !!editorialNarrative : isExpanded && !!editorialNarrative;

  return (
    <div
      ref={ref}
      onClick={editable ? undefined : onClick}
      role={editable ? undefined : "button"}
      tabIndex={editable ? undefined : 0}
      onKeyDown={editable ? undefined : (e) => e.key === "Enter" && onClick()}
      className={clsx(
        !editable && "cursor-pointer",
        "rounded-[12px] transition-colors duration-200 group",
        wide ? "flex flex-row items-center gap-8 px-8 py-5" : "flex flex-col justify-center px-2 py-6",
        !editable && "hover:bg-[rgba(87,75,67,0.03)]"
      )}
    >
      <div className={clsx(wide ? "flex-1 flex flex-col gap-2" : "flex flex-col gap-4")}>
        {/* Room label */}
        <span
          style={{
            fontSize: 'var(--type-fine)',
            fontWeight: 'var(--w-h1)',
            textTransform: "uppercase",
            letterSpacing: 'var(--ls-wide)',
            color: "rgba(87, 75, 67, 0.55)",
            ...stagger(0)
          }}
        >
          {roomLabel}
        </span>

        {/* The owner chooses direct words or an explicitly Folio-authored version
            before reading the room article. Both pools retain their selections. */}
        {editable && (
          <StoryEditRegion>
            <PullQuotePicker
              pullQuote={displaySelection}
              preparing={!!edit?.teasersPreparing || fallbackLines.length > 0}
              chapterIndex={chapterIndex!}
              projectId={edit!.projectId}
              quoteClassName={clsx(
                "font-[var(--font-headline)] italic leading-[1.25] text-[rgba(87,75,67,0.92)]",
                wide ? "text-[var(--type-h4)]" : "text-[var(--type-h3)]",
              )}
              onUpdate={() => edit!.refresh()}
            />
          </StoryEditRegion>
        )}

        {/* Body — narrative when expanded, big pull quote when collapsed.
            For an owner the narrative is always shown, one editable node per
            paragraph so each maps to its own (chapterIndex, paragraphIndex)
            override. */}
        {editable && showNarrative ? (
          <StoryEditRegion className="flex flex-col gap-3" >
            {(editorialParagraphs?.length ? editorialParagraphs : [editorialNarrative ?? ""]).map(
              (para, pi) => (
                <EditableParagraph
                  key={pi}
                  text={para}
                  isEdited={edit!.isEdited(chapterIndex!, pi, "body")}
                  isEditing={edit!.isEditing(chapterIndex!, pi, "body")}
                  placeholder="Paragraph text..."
                  className="whitespace-pre-line font-[var(--font-body)] text-[var(--type-body)] leading-[1.7] text-[rgba(87,75,67,0.85)]"
                  onStartEdit={() => edit!.openEditor(chapterIndex!, pi, "body")}
                  onSave={(t) => edit!.save(chapterIndex!, pi, "body", t)}
                  onCancel={() => edit!.closeEditor()}
                  onRevert={() => edit!.revert(chapterIndex!, pi, "body")}
                />
              ),
            )}
          </StoryEditRegion>
        ) : showNarrative ? (
          <div
            className="whitespace-pre-line"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 'var(--type-body)',
              fontWeight: 'var(--w-body)',
              lineHeight: 1.7, /* folio-design-system: off-scale */
              color: "rgba(87, 75, 67, 0.85)",
              ...stagger(80),
            }}
          >
            {editorialNarrative}
          </div>
        ) : (
          displayQuote && (folioAuthored ? (
            <p className={clsx("font-[var(--font-headline)] italic leading-[var(--lh-h4)] text-[rgba(87,75,67,0.92)]", wide ? "text-[var(--type-h4)]" : "text-[var(--type-h3)]")}>
              {displayQuote}
            </p>
          ) : (
            <blockquote
              style={{
                fontFamily: "var(--font-headline)",
                fontSize: wide ? 'var(--type-h4)' : 'var(--type-h3)',
                fontWeight: 'var(--w-body)',
                fontStyle: "italic",
                lineHeight: 1.25, /* folio-design-system: off-scale */
                color: "rgba(87, 75, 67, 0.92)",
                ...stagger(80),
              }}
            >
              &ldquo;{displayQuote}&rdquo;
            </blockquote>
          ))
        )}

        {/* Per-section regenerate + undo. Kept with the section it acts on,
            which is the whole point of editing in the article. */}
        {editable && (
          <StoryEditRegion>
            <SectionFeedback
              projectId={edit!.projectId}
              chapterIndex={chapterIndex!}
              hasHistory={edit!.hasHistory(chapterIndex!)}
              onRegenerated={() => edit!.refresh()}
            />
          </StoryEditRegion>
        )}

        {/* Attribution */}
        <span
          style={{
            fontSize: 'var(--type-meta)',
            color: "rgba(87, 75, 67, 0.55)",
            ...stagger(160)
          }}
        >
          {folioAuthored ? 'Written by Folio' : <>&mdash; {attribution}</>}
        </span>

        {/* Editorial teaser (optional, only on collapsed regular tiles) */}
        {editorialTeaser && !wide && !showNarrative && (
          <p
            style={{
              fontSize: 'var(--type-meta)',
              lineHeight: 'var(--lh-body)',
              color: "rgba(87, 75, 67, 0.45)",
              ...stagger(240)
            }}
          >
            {editorialTeaser}
          </p>
        )}
      </div>

      {/* Affordance — chevron rotates 180° on expand, product count beside it.
          Hidden for an owner: their narrative is already open, so there is
          nothing to expand and the control would only collapse their own text. */}
      {!editable && (
      <div
        className={clsx(
          wide ? "whitespace-nowrap flex items-center gap-3" : "mt-5 flex items-center gap-3"
        )}
        style={{
          fontSize: 'var(--type-meta)',
          color: "rgba(87, 75, 67, 0.55)",
          ...stagger(320)
        }}
      >
        {productCount > 0 && (
          <span style={{ fontSize: 'var(--type-eyebrow)', color: "rgba(87, 75, 67, 0.4)" }}>
            {productCount} product{productCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="flex items-center gap-1.5 group-hover:text-[rgba(87,75,67,0.85)] transition-colors">
          {isExpanded ? "Collapse" : "Read more"}
          <ChevronDown
            size={16}
            strokeWidth={1.75}
            className="transition-transform duration-300"
            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </span>
      </div>
      )}
    </div>
  );
}
