"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { runSpotlight, SpotlightCommand } from "@/lib/spotlight/service";

type State = Awaited<ReturnType<typeof runSpotlight>>;
export async function spotlightRequest(
  projectId: string,
  command: SpotlightCommand,
): Promise<State> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/spotlight`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    },
  );
  const body = await res.json();
  if (!res.ok)
    throw new Error(body.error || "Could not save. Your draft is retained.");
  return body;
}

export function SpotlightSelections({
  projectId,
  tagIds,
}: {
  projectId: string;
  tagIds?: string[];
}) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tagKey = tagIds?.join(",");
  useEffect(() => {
    let active = true;
    const refresh = (event: Event) => {
      if ((event as CustomEvent).detail?.projectId === projectId)
        spotlightRequest(projectId, { action: "resume" })
          .then((s) => {
            if (active) setState(s);
          })
          .catch((e) => {
            if (active) setError(e.message);
          });
    };
    window.addEventListener("folio:spotlight-change", refresh);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/spotlight`)
      .then((r) => r.json())
      .then((g) => {
        if (g.enabled) return spotlightRequest(projectId, { action: "resume" });
      })
      .then((s) => {
        if (active && s) setState(s);
      })
      .catch(() => {});
    return () => {
      active = false;
      window.removeEventListener("folio:spotlight-change", refresh);
    };
  }, [projectId, tagKey]);
  if (!state) return null;
  return (
    <section
      className="space-y-3 border rounded-lg p-4"
      aria-label="Spotlight selections"
    >
      <p>
        Selected pieces receive private interview questions. Later approval and
        publication integration can bring them into Shop and social stories.
      </p>
      <p className="text-sm">
        Photos of the same piece in the same confirmed room share this switch.
        Turning it off deselects all those photos. Removing one tag only removes
        that photo source.
      </p>
      {state.tags
        .filter((t) => !tagIds || tagIds.includes(t.id))
        .map((t) => {
          const s = state.spotlights.find((s) => s.id === t.spotlightId);
          return (
            <div key={t.id}>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={s?.isSelected || false}
                  onChange={async (e) => {
                    setBusy(true);
                    setError("");
                    try {
                      setState(
                        await spotlightRequest(
                          projectId,
                          !e.target.checked && s
                            ? {
                                action: "deselect",
                                spotlightId: s.id,
                                expectedSelectionVersion: s.selectionVersion,
                              }
                            : {
                                action: "select",
                                tagId: t.id,
                                selected: true,
                                expectedSelectionVersion: s?.selectionVersion,
                              },
                        ),
                      );
                      window.dispatchEvent(
                        new CustomEvent("folio:spotlight-change", {
                          detail: { projectId },
                        }),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                Spotlight this piece: {t.productName}
              </label>
              {!t.roomId && (
                <p>Confirm this photo’s room to receive its question.</p>
              )}
              {s?.needsResolution && (
                <p>
                  History is saved. Confirm a matching room and photo source,
                  then select this piece again.
                </p>
              )}
              {s?.needsResolution && t.roomId && (
                <Button
                  variant="ridge"
                  size="sm"
                  className="mr-2 mb-2"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      setState(
                        await spotlightRequest(projectId, {
                          action: "select",
                          tagId: t.id,
                          selected: true,
                        }),
                      );
                      window.dispatchEvent(
                        new CustomEvent("folio:spotlight-change", {
                          detail: { projectId },
                        }),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Use this photo’s confirmed room
                </Button>
              )}
            </div>
          );
        })}
      {state.spotlights
        .filter(
          (s) =>
            s.needsResolution &&
            !state.tags.some((t) => t.spotlightId === s.id),
        )
        .map((s) => (
          <p key={s.id}>
            A selected piece has no valid photo source. Its saved history is
            retained. Tag it again in its confirmed room to resume.{" "}
            <Button
              variant="ridge"
              size="sm"
              className="mr-2 mb-2"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setState(
                    await spotlightRequest(projectId, {
                      action: "deselect",
                      spotlightId: s.id,
                      expectedSelectionVersion: s.selectionVersion,
                    }),
                  );
                  window.dispatchEvent(
                    new CustomEvent("folio:spotlight-change", {
                      detail: { projectId },
                    }),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Deselect and keep history
            </Button>
          </p>
        ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

function AnswerEditor({
  projectId,
  actorId,
  question,
  state,
  saved,
  ordinary = false,
}: {
  projectId: string;
  actorId: string;
  question: any;
  state: State;
  saved: (s: State) => void;
  ordinary?: boolean;
}) {
  const storageKey = `spotlight-draft:${actorId}:${projectId}:${question.id}`;
  const [text, setText] = useState(
    question.currentAnswer?.acceptedText || question.text || "",
  );
  const [pending, setPending] = useState<SpotlightCommand | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reuseId, setReuseId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (draft) {
        setText(draft.text);
        setPending(draft.pending || null);
      }
    } catch {}
  }, [storageKey]);
  const changeText = (value: string) => {
    setText(value);
    setPending(null);
    setConfirmed(false);
    setReuseId("");
    sessionStorage.setItem(storageKey, JSON.stringify({ text: value }));
  };
  const legacyReuse = state.legacyReuseSources.find(
    (a) => `legacy:${a.questionId}` === reuseId,
  );
  const reuse =
    legacyReuse ||
    state.questions.flatMap((q) => q.answers).find((a) => a.id === reuseId);
  return (
    <article
      className="border rounded-lg p-4 space-y-3"
      data-question-id={question.id}
    >
      <h3>{question.wording}</h3>
      {!ordinary && !question.eligible && (
        <p>
          Saved history only. Select the piece and resolve its photo/room before
          answering.
        </p>
      )}
      <textarea
        aria-label={question.wording}
        className="w-full border rounded p-2"
        rows={4}
        value={text}
        onChange={(e) => changeText(e.target.value)}
      />
      {!ordinary && (
        <details>
          <summary>Reuse a saved answer</summary>
          <select
            aria-label="Answer to reuse"
            value={reuseId}
            onChange={(e) => {
              setReuseId(e.target.value);
              setConfirmed(false);
              setPending(null);
            }}
          >
            <option value="">Choose a saved revision</option>
            {state.questions.flatMap((q) =>
              q.answers.map((a) => (
                <option key={a.id} value={a.id}>
                  {q.wording} — revision {a.revisionNumber}
                </option>
              )),
            )}
            {state.legacyReuseSources.map((a) => (
              <option
                key={`legacy:${a.questionId}`}
                value={`legacy:${a.questionId}`}
              >
                {a.wording} — ordinary saved answer
              </option>
            ))}
          </select>
          {reuse && (
            <>
              <blockquote className="whitespace-pre-wrap">
                {reuse.acceptedText}
              </blockquote>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => {
                    setConfirmed(e.target.checked);
                    if (e.target.checked) {
                      setText(reuse.acceptedText);
                      sessionStorage.setItem(
                        storageKey,
                        JSON.stringify({ text: reuse.acceptedText }),
                      );
                    }
                  }}
                />
                I confirm this exact answer for this question.
              </label>
            </>
          )}
        </details>
      )}
      <Button
        variant="ridge"
        size="sm"
        className="mr-2 mb-2"
        disabled={
          busy || (!ordinary && !question.eligible) || (!!reuseId && !confirmed)
        }
        onClick={async () => {
          setBusy(true);
          setError("");
          const cmd: SpotlightCommand =
            pending ||
            (ordinary
              ? {
                  action: "ordinary",
                  questionId: question.id,
                  text,
                  expectedVersion: question.version || 0,
                  requestKey: crypto.randomUUID(),
                }
              : {
                  action: "accept",
                  questionId: question.id,
                  questionVersion: question.questionVersion,
                  currentAnswerNumber: question.currentAnswerNumber,
                  text,
                  stateVersion: question.stateVersion,
                  selectionVersion: question.selectionVersion,
                  inputModality: "TEXT",
                  requestKey: crypto.randomUUID(),
                  ...(reuseId
                    ? {
                        ...(legacyReuse
                          ? {
                              reuseLegacyQuestionId: legacyReuse.questionId,
                              reuseTextDigest: legacyReuse.textDigest,
                            }
                          : { reuseRevisionId: reuseId }),
                        confirmReuse: confirmed,
                      }
                    : {}),
                });
          setPending(cmd);
          sessionStorage.setItem(
            storageKey,
            JSON.stringify({ text, pending: cmd }),
          );
          try {
            saved(await spotlightRequest(projectId, cmd));
            setPending(null);
            sessionStorage.removeItem(storageKey);
            setError("Saved.");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Save answer
      </Button>
      <Button
        variant="ridge"
        size="sm"
        className="mr-2 mb-2"
        disabled={busy}
        onClick={async () => {
          try {
            saved(await spotlightRequest(projectId, { action: "resume" }));
            setPending(null);
            sessionStorage.setItem(storageKey, JSON.stringify({ text }));
            setError(
              "Loaded the latest saved version. Your text above is retained; review it before saving.",
            );
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Refresh saved version
      </Button>
      {!ordinary &&
        question.kind === "BASE" &&
        question.currentAnswer &&
        question.eligible && (
          <Button
            variant="ridge"
            size="sm"
            className="mr-2 mb-2"
            onClick={async () => {
              try {
                saved(
                  await spotlightRequest(projectId, {
                    action: "followup",
                    questionId: question.id,
                  }),
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Add a follow-up
          </Button>
        )}
      {error && <p role="status">{error}</p>}
      {!ordinary && (
        <details>
          <summary>Saved revisions ({question.answers.length})</summary>
          {question.answers.map((a: any) => (
            <p className="whitespace-pre-wrap" key={a.id}>
              Revision {a.revisionNumber}: {a.acceptedText}
            </p>
          ))}
        </details>
      )}
    </article>
  );
}

export function PrivateSpotlightInterview({
  projectId,
  actorId,
  onClose,
}: {
  projectId: string;
  actorId: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    spotlightRequest(projectId, { action: "schedule" })
      .then(setState)
      .catch((e) => setError(e.message));
  }, [projectId]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Private spotlight interview"
        className="w-[90vw] max-w-3xl max-h-[85vh] bg-surface-card rounded-2xl overflow-auto p-6 md:p-8"
      >
        <div className="max-w-3xl mx-auto space-y-5">
          <Button
            variant="ridge"
            size="sm"
            className="mr-2 mb-2"
            onClick={onClose}
          >
            Close interview
          </Button>
          <h2>Private spotlight interview</h2>
          <p>
            Each selected piece gets a question. Answers stay private. Saving
            does not publish or contact vendors.
          </p>
          {error && <p role="alert">{error}</p>}
          {state ? (
            <>
              <p>
                {
                  state.questions.filter((q) => q.kind === "BASE" && q.eligible)
                    .length
                }{" "}
                selected piece questions
              </p>
              {state.questions
                .filter((q) => q.eligible)
                .map((q) => (
                  <AnswerEditor
                    key={q.id}
                    {...{ projectId, actorId, state }}
                    question={q}
                    saved={setState}
                  />
                ))}
              <details>
                <summary>Earlier ordinary interview answers</summary>
                {state.ordinaryHistory.map((a, i) => (
                  <div key={a.questionId || a.id || i}>
                    <p>{a.prompt || a.questionText}</p>
                    <p className="whitespace-pre-wrap">
                      {a.answer || a.answerText}
                    </p>
                  </div>
                ))}
              </details>
              <h2>Project and rooms</h2>
              {state.ordinary.map((q) => (
                <AnswerEditor
                  key={q.id}
                  {...{ projectId, actorId, state }}
                  ordinary
                  question={q}
                  saved={setState}
                />
              ))}
              <details>
                <summary>Inactive spotlight history</summary>
                {state.questions
                  .filter((q) => !q.eligible)
                  .map((q) => (
                    <AnswerEditor
                      key={q.id}
                      {...{ projectId, actorId, state }}
                      question={q}
                      saved={setState}
                    />
                  ))}
              </details>
            </>
          ) : (
            <p>Loading saved interview…</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
