"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Sparkles } from "lucide-react";
import { InterviewModal } from "@/components/posting/interview/InterviewModal";
import { AnswerModal } from "@/components/posting/interview/AnswerModal";

type QA = {
  q: string;
  a: string;
  questionId?: string;
  roomId?: string | null;
  section?: string;
  isFeatured?: boolean;
};

/** Per-room interview coverage, computed server-side by the interview GET. */
type Coverage = {
  roomId: string;
  roomName: string;
  answered: number;
  total: number;
  complete: boolean;
};

type PanelImage = {
  id: string;
  url: string;
  name?: string | null;
  room?: string | null;
  roomId?: string | null;
  displayOrder?: number | null;
};

/** The pseudo-room every project-level answer belongs to. */
const PROJECT_KEY = "project";
const PROJECT_LABEL = "The project";

/**
 * The five fixed project-level question categories, in the order the interview
 * asks them, under the names the Story tab shows. The ids they are read from are
 * `project-<CATEGORY>-<uuid>` (see generateProjectQuestions).
 */
const PROJECT_CARDS: Array<{ category: string; label: string }> = [
  { category: "CLIENT_BRIEF", label: "Origin story" },
  { category: "SCOPE_PARAMETERS", label: "Scope" },
  { category: "DESIGN_DIRECTION", label: "Design direction" },
  { category: "SIGNATURE_IDENTITY", label: "Signature" },
  { category: "SURPRISE_PIVOT", label: "Turning point" },
];

/** The category a project-level question id encodes, if it carries one. */
function projectCategoryOf(questionId: string | undefined): string | null {
  const m = (questionId || "").match(/^project-([A-Z_]+)-/);
  return m ? m[1] : null;
}

/** Title-case a raw category token, for answers outside the five fixed cards. */
function humanizeCategory(raw: string): string {
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

/**
 * Which room an answer belongs to. `roomId` is first-class on saved answers, and
 * the interview stores project-level answers with none, so a missing roomId
 * means "about the project as a whole".
 */
function roomKeyFor(qa: QA): string {
  if (typeof qa.roomId === "string" && qa.roomId) return qa.roomId;
  return PROJECT_KEY;
}

/** One room's tile + panel data, assembled from answers, coverage and photos. */
type RoomEntry = {
  roomId: string;
  name: string;
  answers: QA[];
  photos: PanelImage[];
  coverage?: Coverage;
};

interface StoryInterviewPanelProps {
  projectId: string;
  projectName: string;
  /** Photos only — documents are filtered out upstream. */
  images: PanelImage[];
  /** The project's rooms, in project order. */
  rooms: Array<{ id: string; name: string }>;
}

/**
 * StoryInterviewPanel — the Story step's room index.
 *
 * The tab used to render every captured answer expanded in one column, which
 * nobody reads at thirty answers. It is now an index: coverage at the top, the
 * project's five framing answers as cards, then one tile per room. Rooms are
 * collapsed by default and open one at a time into a single panel below the
 * grid, so the page stays about the same height however much has been said.
 *
 * Nothing is dropped by collapsing — every question the interview asked is still
 * reachable, nested under its room instead of listed flat. Editing happens in
 * AnswerModal, never inline: that is what keeps a room panel to one row per
 * answer.
 */
export default function StoryInterviewPanel({
  projectId,
  projectName,
  images,
  rooms,
}: StoryInterviewPanelProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<QA[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // The interview modal, and how it should open: resume where the designer left
  // off, restart, or scoped to one room they picked.
  const [interview, setInterview] = useState<
    | { intent: "resume" | "restart" | null; roomId?: string | null; mode?: "realtime" }
    | null
  >(null);

  // The one room whose panel is open. Single-open accordion — clicking the open
  // room's tile closes it.
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);

  // The one answer being edited, with the context the modal shows in its header.
  const [editing, setEditing] = useState<{
    qa: QA;
    contextLabel: string;
    contextRoomId: string;
    position: { index: number; total: number };
  } | null>(null);

  const fetchAnswers = useCallback(async () => {
    try {
      const res = await fetch(`/api/posting/project/${projectId}/interview`);
      if (res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data.answers) ? data.answers : [];
        const mapped: QA[] = raw
          .map((a: any) => ({
            // The GET backfills `prompt` from the persisted question set, so
            // answers saved before question text was stored still read correctly.
            q: a.prompt || a.question || a.q || "",
            a: a.answer || a.a || "",
            questionId: a.questionId || a.id,
            roomId: a.roomId ?? null,
            section: a.section,
            isFeatured: !!a.isFeatured,
          }))
          .filter((qa: QA) => (qa.q || "").trim() || (qa.a || "").trim());
        setAnswers(mapped);
        setCoverage(Array.isArray(data.coverage) ? data.coverage : []);
      }
    } catch (err) {
      console.error("[StoryInterviewPanel] Failed to load answers", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAnswers();
  }, [fetchAnswers]);

  const answersByRoom = useMemo(() => {
    const byRoom = new Map<string, QA[]>();
    for (const qa of answers) {
      const key = roomKeyFor(qa);
      const list = byRoom.get(key);
      if (list) list.push(qa);
      else byRoom.set(key, [qa]);
    }
    return byRoom;
  }, [answers]);

  const photosByRoom = useMemo(() => {
    const byRoom = new Map<string, PanelImage[]>();
    for (const img of images) {
      const key = img.roomId;
      if (!key) continue;
      const list = byRoom.get(key);
      if (list) list.push(img);
      else byRoom.set(key, [img]);
    }
    for (const list of Array.from(byRoom.values())) {
      list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    }
    return byRoom;
  }, [images]);

  const coverageByRoom = useMemo(
    () => new Map(coverage.map((c) => [c.roomId, c])),
    [coverage],
  );

  /**
   * Every room the index knows about: the project's own rooms in project order,
   * then any room an answer refers to that no longer exists. Keeping the strays
   * is deliberate — losing their answers from the index would read as data loss.
   */
  const roomEntries = useMemo<RoomEntry[]>(() => {
    const seen = new Set<string>();
    const entries: RoomEntry[] = rooms.map((room) => {
      seen.add(room.id);
      return {
        roomId: room.id,
        name: room.name,
        answers: answersByRoom.get(room.id) ?? [],
        photos: photosByRoom.get(room.id) ?? [],
        coverage: coverageByRoom.get(room.id),
      };
    });
    for (const [key, list] of Array.from(answersByRoom.entries())) {
      if (key === PROJECT_KEY || seen.has(key)) continue;
      entries.push({
        roomId: key,
        name: coverageByRoom.get(key)?.roomName ?? "Another room",
        answers: list,
        photos: photosByRoom.get(key) ?? [],
        coverage: coverageByRoom.get(key),
      });
    }
    return entries;
  }, [rooms, answersByRoom, photosByRoom, coverageByRoom]);

  const writtenUp = useMemo(
    () => roomEntries.filter((r) => r.answers.length > 0),
    [roomEntries],
  );
  const notWrittenUp = useMemo(
    () => roomEntries.filter((r) => r.answers.length === 0),
    [roomEntries],
  );

  const writtenAnswerCount = useMemo(
    () => writtenUp.reduce((sum, r) => sum + r.answers.length, 0),
    [writtenUp],
  );

  /**
   * The five framing cards, plus a card for any project-level answer that falls
   * outside them (a follow-up, or a question set from before the categories were
   * fixed). Nothing captured is unreachable from the index.
   */
  const projectCards = useMemo(() => {
    const projectAnswers = answersByRoom.get(PROJECT_KEY) ?? [];
    const byCategory = new Map<string, QA>();
    const extras: Array<{ label: string; answer: QA }> = [];
    for (const qa of projectAnswers) {
      const category = projectCategoryOf(qa.questionId);
      if (category && PROJECT_CARDS.some((c) => c.category === category) && !byCategory.has(category)) {
        byCategory.set(category, qa);
      } else {
        extras.push({
          label: category ? humanizeCategory(category) : "Also said",
          answer: qa,
        });
      }
    }
    return [
      ...PROJECT_CARDS.map((card) => ({
        label: card.label,
        answer: byCategory.get(card.category) ?? null,
      })),
      ...extras.map((e) => ({ label: e.label, answer: e.answer })),
    ];
  }, [answersByRoom]);

  const projectAnsweredCount = projectCards.filter((c) => (c.answer?.a || "").trim()).length;

  // Coverage reads in rooms, because that is the unit the index is built from:
  // a room counts once it has anything said about it.
  const roomsTotal = roomEntries.length;
  const roomsAnswered = writtenUp.length;
  const coveragePct = roomsTotal > 0 ? (roomsAnswered / roomsTotal) * 100 : 0;

  /** Rooms whose write-up the article can include vs those it can't yet. */
  const included = useMemo(() => coverage.filter((c) => c.complete && c.roomId !== PROJECT_KEY), [coverage]);
  const canGenerate = answers.length > 0 && included.length > 0 && !generating;

  /**
   * Where "Resume interview" lands: the first room still under its question
   * target, else the first room with nothing said about it. Undefined hands the
   * modal back its own resume plan.
   */
  const resumeRoomId = useMemo(() => {
    const underTarget = roomEntries.find(
      (r) => r.coverage && r.coverage.total > 0 && r.coverage.answered < r.coverage.total,
    );
    if (underTarget) return underTarget.roomId;
    return notWrittenUp[0]?.roomId;
  }, [roomEntries, notWrittenUp]);

  function openRestart() {
    const ok = window.confirm(
      "This clears your saved interview answers and starts a new interview. Continue?",
    );
    if (!ok) return;
    setInterview({ intent: "restart" });
  }

  function handleInterviewOpenChange(open: boolean) {
    if (open) return;
    // Re-sync once the modal closes: answers may have changed (resume added
    // some, restart cleared them). router.refresh() re-derives the tracker /
    // editorial state to match.
    setInterview(null);
    fetchAnswers();
    router.refresh();
  }

  /**
   * Save one edited answer. The POST merges non-destructively by questionId, so
   * sending the full list updates this answer and leaves the rest untouched. The
   * counts and coverage above refresh from the re-fetch — no page reload, and no
   * router.refresh(): rewording an answer changes no server-derived state.
   */
  const commitEdit = useCallback(
    async (target: QA, nextAnswer: string) => {
      setSaving(true);
      try {
        const next = answers.map((qa) => (qa === target ? { ...qa, a: nextAnswer } : qa));
        const res = await fetch(`/api/posting/project/${projectId}/interview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: next.map((qa) => ({
              questionId: qa.questionId || qa.q,
              answer: qa.a || "",
              question: qa.q || "",
              prompt: qa.q || "",
              roomId: qa.roomId ?? null,
              isFeatured: !!qa.isFeatured,
            })),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save answer");
        }
        setAnswers(next);
        setEditing(null);
        await fetchAnswers();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to save answer");
      } finally {
        setSaving(false);
      }
    },
    [answers, projectId, fetchAnswers],
  );

  /**
   * Generate the draft from the answers already saved on the server, then open
   * the Publish step on it. The draft never lands on this tab — Story captures
   * and edits answers, Publish is where the writing is reviewed. Only complete
   * rooms are composed into the story; partly answered rooms become gallery
   * chapters rather than thin write-ups.
   */
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const completedRoomIds = included.map((c) => c.roomId);
      const res = await fetch(
        `/api/posting/project/${projectId}/interview/generate?forceOverwriteDraft=true&mode=recomposition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            forceOverwriteDraft: true,
            mode: "recomposition",
            completedRoomIds,
          }),
        },
      );

      // 202 = generation accepted and still running; the Publish tab shows its
      // own progress/empty state until the draft lands.
      if (!res.ok && res.status !== 202) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Draft generation failed. Please try again.");
      }

      router.push(`/project/${projectId}?view=publish`);
      router.refresh();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Draft generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [projectId, included, router]);

  const openRoom = openRoomId
    ? roomEntries.find((r) => r.roomId === openRoomId) ?? null
    : null;

  return (
    <div className="space-y-10">
      {/* 1 — Progress header. Generate lives here so it never needs scrolling to. */}
      <header className="rounded-md border border-folio-border-subtle bg-surface-ground p-6 shadow-folio1">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-xl">
            <p className="text-folio-eyebrow font-semibold uppercase text-folio-text-tertiary">
              Step 4 of 5 — Story
            </p>
            <h1 className="mt-2 font-headline text-[30px] font-medium leading-tight text-folio-text-primary">
              Your story, room by room
            </h1>
            <p className="mt-2 text-folio-body text-folio-text-secondary">
              Open a room to read or edit what you said. Generate the draft whenever you&apos;re
              ready — you review it in Publish, and you can come back and add rooms after.
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-4 lg:items-end">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openRestart}
                className="rounded-sm px-3 py-2 text-folio-ui font-medium text-folio-text-tertiary transition-colors duration-150 ease-folio hover:text-folio-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold"
              >
                Restart
              </button>
              <button
                type="button"
                onClick={() => setInterview({ intent: "resume", roomId: resumeRoomId })}
                className="rounded-sm border border-folio-gold px-4 py-2.5 text-folio-ui font-medium text-folio-gold transition-[transform,background-color] duration-150 ease-folio hover:-translate-y-px hover:bg-folio-gold/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold"
              >
                {answers.length > 0 ? "Resume interview" : "Start interview"}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                title={
                  canGenerate ? undefined : "Finish at least one room to generate the draft"
                }
                className="inline-flex items-center gap-2 rounded-sm bg-folio-text-primary px-5 py-2.5 text-folio-ui font-semibold text-white transition-[transform,opacity] duration-150 ease-folio hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {generating ? "Generating draft…" : "Generate draft"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div
                className="h-1 w-[220px] overflow-hidden rounded-full bg-folio-border-subtle"
                role="progressbar"
                aria-valuenow={roomsAnswered}
                aria-valuemin={0}
                aria-valuemax={roomsTotal}
                aria-label="Rooms with a write-up"
              >
                <div
                  className="h-full rounded-full bg-folio-gold transition-[width] duration-med ease-folio"
                  style={{ width: `${coveragePct}%` }}
                />
              </div>
              <span className="font-metricsMono text-[12px] tabular-nums text-folio-text-secondary">
                {roomsAnswered}/{roomsTotal} rooms
              </span>
            </div>

            {generateError && (
              <p className="text-folio-meta text-folio-accent-700">{generateError}</p>
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <p className="text-folio-ui text-folio-text-tertiary">Loading your answers…</p>
      ) : (
        <>
          {/* 2 — The project. The five framing answers, as cards. */}
          <section>
            <SectionHeader
              title="The project"
              caption="The frame the whole piece hangs on"
              count={`${projectAnsweredCount}/${projectCards.length} answered`}
            />
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]">
              {projectCards.map((card, cardIndex) => (
                <ProjectCard
                  key={card.answer?.questionId ?? `${card.label}-${cardIndex}`}
                  label={card.label}
                  answer={card.answer}
                  onOpen={() => {
                    if (card.answer) {
                      const projectAnswers = answersByRoom.get(PROJECT_KEY) ?? [];
                      setEditing({
                        qa: card.answer,
                        contextLabel: PROJECT_LABEL,
                        contextRoomId: PROJECT_KEY,
                        position: {
                          index: projectAnswers.indexOf(card.answer) + 1,
                          total: projectAnswers.length,
                        },
                      });
                    } else {
                      // Nothing saved for this category yet, so there is no
                      // question id to edit — the interview owns asking it.
                      setInterview({ intent: "resume", roomId: PROJECT_KEY });
                    }
                  }}
                />
              ))}
            </div>
          </section>

          {/* 3 — Written up. Collapsed room tiles over one shared detail panel. */}
          {writtenUp.length > 0 && (
            <section>
              <SectionHeader
                title="Written up"
                caption="Open a room to read, edit, or add"
                count={`${writtenUp.length} ${writtenUp.length === 1 ? "room" : "rooms"} · ${writtenAnswerCount} ${
                  writtenAnswerCount === 1 ? "answer" : "answers"
                }`}
              />
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
                {writtenUp.map((room) => (
                  <RoomTile
                    key={room.roomId}
                    room={room}
                    selected={openRoomId === room.roomId}
                    onToggle={() =>
                      setOpenRoomId((current) =>
                        current === room.roomId ? null : room.roomId,
                      )
                    }
                  />
                ))}
              </div>

              {openRoom && (
                <RoomPanel
                  room={openRoom}
                  onClose={() => setOpenRoomId(null)}
                  onAnswerAnother={() =>
                    setInterview({ intent: "resume", roomId: openRoom.roomId })
                  }
                  onEdit={(qa, index) =>
                    setEditing({
                      qa,
                      contextLabel: openRoom.name,
                      contextRoomId: openRoom.roomId,
                      position: { index: index + 1, total: openRoom.answers.length },
                    })
                  }
                />
              )}
            </section>
          )}

          {/* 4 — No write-up yet. Low-weight rows, not photo tiles. */}
          {notWrittenUp.length > 0 && (
            <section>
              <SectionHeader
                title="No write-up yet"
                caption="These rooms publish as photos only until you say something about them"
                count={`${notWrittenUp.length} ${notWrittenUp.length === 1 ? "room" : "rooms"}`}
              />
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]">
                {notWrittenUp.map((room) => (
                  <button
                    key={room.roomId}
                    type="button"
                    onClick={() => setInterview({ intent: "resume", roomId: room.roomId })}
                    className="group flex items-center justify-between gap-3 rounded-neu-sm border border-dashed border-folio-border-strong bg-surface-canvas px-4 py-3 text-left transition-[transform,border-color,background-color] duration-med ease-folio hover:-translate-y-px hover:border-solid hover:border-folio-gold hover:bg-surface-ground focus:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-folio-ui font-medium text-folio-text-primary">
                        {room.name}
                      </span>
                      <span className="block text-folio-meta text-folio-text-tertiary">
                        {room.photos.length} {room.photos.length === 1 ? "photo" : "photos"}, no
                        write-up
                      </span>
                    </span>
                    <span className="shrink-0 text-folio-meta font-medium text-folio-gold">
                      Answer
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Full interview flow. Mounted only while open so its question-generation
          hooks (which fetch on mount, not on Dialog-open) don't fire on every
          Story tab view. */}
      {interview && (
        <InterviewModal
          open
          onOpenChange={handleInterviewOpenChange}
          projectId={projectId}
          projectName={projectName}
          images={images.map((img) => ({
            id: img.id,
            url: img.url,
            name: img.name ?? undefined,
            room: img.room ?? null,
            roomId: img.roomId ?? null,
            displayOrder: img.displayOrder ?? null,
          }))}
          initialIntent={interview.intent}
          initialRoomId={interview.roomId ?? null}
          initialMode={interview.mode}
        />
      )}

      {/* Every edit on this tab, everywhere, opens here. */}
      {editing && (
        <AnswerModal
          contextLabel={editing.contextLabel}
          position={editing.position}
          question={editing.qa.q}
          initialValue={editing.qa.a}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={(nextAnswer) => commitEdit(editing.qa, nextAnswer)}
          onReRecord={() => {
            const roomId = editing.contextRoomId;
            setEditing(null);
            setInterview({ intent: "resume", roomId, mode: "realtime" });
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Section header — one pattern, used by all three sections
 * ------------------------------------------------------------------------- */

function SectionHeader({
  title,
  caption,
  count,
}: {
  title: string;
  caption: string;
  count: string;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-folio-border-subtle pb-3">
      <div className="min-w-0">
        <h2 className="font-headline text-folio-h4 text-folio-text-primary">
          {title}
        </h2>
        <p className="mt-0.5 text-folio-meta text-folio-text-tertiary">{caption}</p>
      </div>
      <span className="shrink-0 font-metricsMono text-[12px] tabular-nums text-folio-text-tertiary">
        {count}
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * The project — one card per framing question
 * ------------------------------------------------------------------------- */

function ProjectCard({
  label,
  answer,
  onOpen,
}: {
  label: string;
  answer: QA | null;
  onOpen: () => void;
}) {
  const text = (answer?.a || "").trim();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full flex-col rounded-neu-sm border border-folio-border-subtle bg-surface-canvas px-4 py-3.5 text-left transition-[transform,border-color,box-shadow] duration-med ease-folio hover:-translate-y-px hover:border-folio-gold hover:shadow-folio1 focus:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold"
    >
      <span className="text-folio-eyebrow font-semibold uppercase text-folio-gold">
        {label}
      </span>
      <span className="mt-2 line-clamp-3 flex-1 text-folio-body text-folio-text-secondary">
        {text || "Nothing here yet."}
      </span>
      <span className="mt-3 text-folio-meta text-folio-text-tertiary">
        {text ? "Answered" : "Needs a line"}
      </span>
    </button>
  );
}

/* ----------------------------------------------------------------------------
 * Written up — room tiles and the single detail panel below them
 * ------------------------------------------------------------------------- */

function RoomTile({
  room,
  selected,
  onToggle,
}: {
  room: RoomEntry;
  selected: boolean;
  onToggle: () => void;
}) {
  const hero = room.photos[0];
  const remaining =
    room.coverage && room.coverage.total > 0
      ? Math.max(0, room.coverage.total - room.coverage.answered)
      : 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={selected}
      className={`group relative aspect-[4/3] overflow-hidden rounded-md text-left transition-[transform,box-shadow] duration-med ease-folio hover:-translate-y-0.5 hover:shadow-folio2 focus:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold ${
        selected ? "ring-2 ring-inset ring-folio-gold" : ""
      }`}
      style={
        hero
          ? { backgroundImage: `url(${hero.url})`, backgroundSize: "cover", backgroundPosition: "center" }
          : {
              backgroundImage:
                "linear-gradient(150deg, var(--folio-accent-200), var(--surface-elevated))",
            }
      }
    >
      <span
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(22,22,20,.72), rgba(22,22,20,.28) 44%, rgba(22,22,20,.06))",
        }}
        aria-hidden
      />

      {remaining > 0 && (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-neu-pill bg-white/90 px-2.5 py-1 text-[11px] font-medium text-folio-accent-700 [backdrop-filter:blur(8px)_saturate(160%)]">
          <span className="h-1.5 w-1.5 rounded-full bg-folio-gold-ornament" aria-hidden />
          {remaining} more to go
        </span>
      )}

      <span className="absolute inset-x-4 bottom-3.5">
        <span className="block font-headline text-[20px] font-medium leading-tight text-white">
          {room.name}
        </span>
        <span className="mt-0.5 block text-folio-meta text-[rgba(255,255,255,.82)]">
          {room.answers.length} {room.answers.length === 1 ? "answer" : "answers"} ·{" "}
          {room.photos.length} {room.photos.length === 1 ? "photo" : "photos"}
        </span>
      </span>
    </button>
  );
}

function RoomPanel({
  room,
  onClose,
  onAnswerAnother,
  onEdit,
}: {
  room: RoomEntry;
  onClose: () => void;
  onAnswerAnother: () => void;
  onEdit: (qa: QA, index: number) => void;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-folio-border-strong bg-surface-ground shadow-folio2">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-canvas px-6 py-5">
        <div className="min-w-0">
          <h3 className="font-headline text-[26px] font-medium leading-tight text-folio-text-primary">
            {room.name}
          </h3>
          <p className="mt-0.5 font-metricsMono text-[12px] tabular-nums text-folio-text-tertiary">
            {room.answers.length} {room.answers.length === 1 ? "answer" : "answers"} ·{" "}
            {room.photos.length} {room.photos.length === 1 ? "photo" : "photos"}
            {room.coverage && room.coverage.total > 0
              ? ` · ${room.coverage.answered}/${room.coverage.total} asked`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAnswerAnother}
            className="rounded-sm border border-folio-border-strong px-4 py-2 text-folio-ui font-medium text-folio-text-secondary transition-[transform,border-color,color] duration-150 ease-folio hover:-translate-y-px hover:border-folio-gold hover:text-folio-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold"
          >
            Answer another question
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm px-3 py-2 text-folio-ui font-medium text-folio-text-tertiary transition-colors duration-150 ease-folio hover:text-folio-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold"
          >
            Close
          </button>
        </div>
      </div>

      <ul>
        {room.answers.map((qa, i) => (
          <li key={qa.questionId || `${room.roomId}-${i}`}>
            <button
              type="button"
              onClick={() => onEdit(qa, i)}
              className="grid w-full grid-cols-[260px_1fr_auto] items-start gap-6 border-b border-folio-border-subtle px-6 py-5 text-left transition-colors duration-150 ease-folio hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-folio-gold"
            >
              <span className="font-headline text-[17px] italic leading-snug text-folio-accent-700">
                {qa.q?.trim() || "This question's wording wasn't saved"}
              </span>
              <span className="whitespace-pre-wrap text-folio-body text-folio-text-secondary">
                {qa.a?.trim() || "Nothing said yet."}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-folio-meta font-medium text-folio-gold">
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
