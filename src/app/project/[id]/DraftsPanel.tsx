"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, X } from "lucide-react";

type QA = { 
  q?: string; 
  a?: string; 
  question?: string;
  answer?: string;
  questionId?: string; 
  id?: string;
};

type InterviewPayload = {
  answers?: QA[];
  followups?: QA[];
  imageOrder?: string[];
  selectedQuestionIds?: string[];
};

type Interview = {
  id: string;
  status?: string;
  answers?: QA[];
  followUps?: QA[];
  payload?: InterviewPayload;
  updatedAt?: string;
};

type DraftVersion = {
  id: string;
  createdAt: string;
  status: string; // DRAFT | PUBLISHED
  slug?: string;
  lead?: { kicker?: string; title?: string; deck?: string };
  sections?: any[];
};

export default function DraftsPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<{
    interview: Interview;
    drafts: DraftVersion[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [answers, setAnswers] = useState<QA[]>([]);
  const [followups, setFollowups] = useState<QA[]>([]);
  const [saving, setSaving] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const debugMode = searchParams.get('debug') === '1';
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugPayload, setDebugPayload] = useState<any>(null);

  // Deduplicate answers by question and answer content (normalized)
  const dedupeAnswers = (answers: QA[]): QA[] => {
    const seen = new Map<string, QA>();
    for (const qa of answers) {
      // Dedupe by answer content (normalized) since question IDs are unreliable
      const answerKey = (qa.a || qa.answer || "").toLowerCase().trim().slice(0, 50);
      const questionKey = (qa.q || qa.question || "").toLowerCase().trim();
      const key = `${questionKey}::${answerKey}`;
      
      if (key && key !== "::" && !seen.has(key)) {
        seen.set(key, qa);
      }
    }
    return Array.from(seen.values());
  };

  // Fetch data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/posting/project/${projectId}/drafts`);
      if (res.ok) {
        const result = await res.json();
        setData(result);

        // Sync answers and followups with auto-dedupe
        if (result.interview?.answers && result.interview.answers.length > 0) {
          const mappedAnswers = result.interview.answers.map((a: any) => ({
            q: a.question || a.q || '',
            a: a.answer || a.a || '',
            question: a.question || a.q || '',
            answer: a.answer || a.a || '',
            questionId: a.questionId || a.id,
          }));

          setAnswers(dedupeAnswers(mappedAnswers));
        } else {
          setAnswers([]);
        }
        if (result.interview?.followUps && result.interview.followUps.length > 0) {
          setFollowups(result.interview.followUps.map((f: any) => ({
            q: f.question || f.q || f.prompt || '',
            a: f.answer || f.a || '',
            question: f.question || f.q || f.prompt || '',
            answer: f.answer || f.a || '',
          })));
        } else {
          setFollowups([]);
        }
      } else {
        console.error('[DraftsPanel] Fetch failed with status:', res.status);
      }
    } catch (error) {
      console.error("[DraftsPanel] Fetch failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const filteredAnswers = answers.filter((qa) => (qa.q || qa.question || "").trim() || (qa.a || qa.answer || "").trim());
  const filteredFollowups = followups.filter((qa) => (qa.q || qa.question || "").trim() || (qa.a || qa.answer || "").trim());

  const currentPost = useMemo(() => data?.drafts?.[0], [data]);
  const currentLead = useMemo(() => currentPost?.lead, [currentPost]);
  const currentSections = useMemo(() => {
    const sections = currentPost?.sections ?? [];
    return Array.isArray(sections) ? sections : [];
  }, [currentPost]);

  async function saveAnswers() {
    try {
      setSaving(true);
      const res = await fetch(`/api/posting/project/${projectId}/interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: filteredAnswers.map((qa) => ({
            questionId: qa.questionId || qa.q || qa.question,
            answer: qa.a || qa.answer || '',
            question: qa.q || qa.question || '',
          })),
          followUps: filteredFollowups.map((qa) => ({
            question: qa.q || qa.question || '',
            answer: qa.a || qa.answer || '',
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        alert(error.error || "Failed to save answers");
        return;
      }

      await fetchData();
    } catch (error: any) {
      console.error("[DraftsPanel] Save failed", error);
      alert("Failed to save answers");
    } finally {
      setSaving(false);
    }
  }

  // Debounced autosave (disabled for now - use manual save button)
  // Uncomment to enable autosave on keystroke
  // useEffect(() => {
  //   if (saveTimeout) {
  //     clearTimeout(saveTimeout);
  //   }

  //   const timer = setTimeout(() => {
  //     if (filteredAnswers.length > 0 || filteredFollowups.length > 0) {
  //       saveAnswers();
  //     }
  //   }, 800);

  //   setSaveTimeout(timer);

  //   return () => {
  //     if (timer) clearTimeout(timer);
  //   };
  // }, [answers, followups]);

  async function regenerate(opts: { overwrite: boolean }) {
    try {
      setRegenBusy(true);
      
      // Save answers first (don't show error if this fails, just proceed)
      if (!debugMode) {
        try {
          await saveAnswers();
        } catch (saveError) {
          console.warn("[DraftsPanel] Save before regenerate failed, continuing anyway", saveError);
        }
      }

      const url = `/api/posting/project/${projectId}/interview/generate?forceOverwriteDraft=true&mode=recomposition`;
      
      const payload: any = {
        source: "drafts_tab",
        forceOverwriteDraft: true, // also in body, redundant on purpose
        mode: 'recomposition', // Default to recomposition mode
      };
      
      if (debugMode) {
        payload.debugEcho = true;
        payload.answersOverride = filteredAnswers.map((qa) => ({
          questionId: qa.questionId || qa.q,
          answer: qa.a,
          question: qa.q,
        }));
        payload.followupsOverride = filteredFollowups.map((qa) => ({
          question: qa.q,
          answer: qa.a,
        }));
        // Remove forceOverwriteDraft in debug mode (dry-run)
        delete payload.forceOverwriteDraft;
      }
      
      const res = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Debug-Client": "drafts",
        },
        cache: 'no-store',
        body: JSON.stringify(payload),
      });

      if (res.status === 202) {
        console.warn('[UI] Regenerate short-circuited: 202 draft exists');
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Draft already exists (server returned 202).');
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const errorCode = json?.code || 'COMPOSE_ERROR';
        const errorMessage = json?.error || json?.message || `Editorial generation failed (${res.status})`;
        const errorDetails = json?.issues ? `\n\nValidation errors:\n${JSON.stringify(json.issues, null, 2)}` : '';
        console.error("[DraftsPanel] Regenerate failed", { 
          status: res.status, 
          code: errorCode, 
          message: errorMessage,
          issues: json?.issues 
        });
        
        // Show user-friendly error message with validation details
        alert(`Editorial generation failed\n\nThe AI didn't return a valid magazine article. Nothing was saved.\n\nError code: ${errorCode}\nError: ${errorMessage}${errorDetails}\n\nTry Regenerate.`);
        return;
      }

      const result = await res.json().catch(() => ({}));

      // Debug mode: show JSON in modal
      if (debugMode) {
        setDebugPayload(result);
        setDebugOpen(true);
        alert("Dry-run complete. Inspect JSON in the modal.");
        return;
      }

      // IMPORTANT: bust app-router cache
      router.refresh();
      
      // Refresh data to show updated draft (don't wait for it)
      fetchData().catch(console.error);
      
      // Navigate to preview page to see the regenerated article
      router.push(`/designer/projects/${projectId}/preview`);
    } catch (error: any) {
      console.error("[DraftsPanel] Regenerate failed", error);
      alert(`Failed to regenerate draft: ${error.message || 'Unknown error'}`);
    } finally {
      setRegenBusy(false);
    }
  }

  async function reAskFollowups() {
    try {
      const res = await fetch(`/api/posting/project/${projectId}/interview/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: filteredAnswers.map(qa => ({
            questionId: qa.questionId || qa.q || `fallback-${Math.random()}`,
            answer: qa.a
          }))
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate follow-ups");
      }
      
      const result = await res.json();
      // Note: API returns "followups" not "followUps"
      const newFollowups = result.followups?.map((f: any) => ({
        q: f.text || f.question || f.prompt || '',
        a: f.answer || "",
        questionId: f.questionId
      })) ?? [];
      
      setFollowups(prev => [...prev, ...newFollowups]);
      await fetchData();
    } catch (err) {
      console.error("Follow-ups error:", err);
      alert(err instanceof Error ? err.message : "Failed to generate follow-ups");
    }
  }

  function setAnswer(i: number, key: "q" | "a", value: string) {
    const next = [...answers];
    next[i] = { 
      ...next[i], 
      [key]: value,
      // Sync both field names
      ...(key === "a" ? { answer: value } : {}),
      ...(key === "q" ? { question: value } : {}),
    };
    setAnswers(next);
  }

  function addAnswer() {
    setAnswers([...answers, { q: "", a: "" }]);
  }

  function removeAnswer(i: number) {
    const next = answers.filter((_, idx) => idx !== i);
    setAnswers(next);
  }

  function setFollowup(i: number, key: "q" | "a", value: string) {
    const next = [...followups];
    next[i] = { 
      ...next[i], 
      [key]: value,
      // Sync both field names
      ...(key === "a" ? { answer: value } : {}),
      ...(key === "q" ? { question: value } : {}),
    };
    setFollowups(next);
  }

  function addFollowup() {
    setFollowups([...followups, { q: "", a: "" }]);
  }

  function removeFollowup(i: number) {
    const next = followups.filter((_, idx) => idx !== i);
    setFollowups(next);
  }

  const handleStartOver = async () => {
    const confirmed = window.confirm(
      "This will clear your current reflections and begin a new interview. Continue?"
    );

    if (!confirmed) return;

    try {
      // Clear answers from state
      setAnswers([]);
      setFollowups([]);

      // Clear localStorage draft (check both possible key formats)
      if (typeof window !== "undefined") {
        localStorage.removeItem(`interviewDraft:${projectId}`);
        localStorage.removeItem(`interview-draft-${projectId}`);
      }

      // Clear from database - POST empty answers AND empty selectedQuestionIds
      const clearRes = await fetch(`/api/posting/project/${projectId}/interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: [],
          followUps: [],
          selectedQuestionIds: [] // Explicitly clear selected questions
        })
      });

      const responseData = await clearRes.json().catch(() => ({}));

      if (!clearRes.ok) {
        const error = responseData.error || "Failed to clear answers";
        throw new Error(error);
      }

      // Refresh current page data first to ensure UI reflects cleared state
      await fetchData();

      // Navigate to preview page with query param to auto-open interview modal
      const targetUrl = `/designer/projects/${projectId}/preview?startInterview=true`;
      router.push(targetUrl);

    } catch (err) {
      console.error("[StartOver] Error:", err);
      alert("Failed to reset interview: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };


  if (isLoading) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)]">Loading drafts...</div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-8 space-y-8">
        {/* Your Reflections Section */}
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="folio-h3 text-[var(--text-primary)]">Your Reflections</h2>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 folio-ui font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                onClick={addAnswer}
              >
                + Add
              </button>
            </div>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
            {filteredAnswers.length === 0 && (
              <p className="folio-ui text-[var(--text-tertiary)] italic">
                No reflections yet. Add your first reflection above.
              </p>
            )}
            {filteredAnswers.map((qa, i) => (
              <div
                key={i}
                className="border border-[var(--border-default)] rounded-lg p-4 mb-3"
              >
                <label className="block folio-ui font-medium text-[var(--text-primary)] mb-2">
                  {qa.q || qa.question || "Your reflection"}
                </label>
                <textarea
                  value={qa.a || qa.answer || ""}
                  onChange={(e) => setAnswer(i, "a", e.target.value)}
                  className="w-full min-h-[80px] p-2 border border-[var(--border-default)] rounded folio-ui resize-y bg-[var(--bg-base)]"
                  placeholder="Share your thoughts..."
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => removeAnswer(i)}
                    className="text-[var(--text-tertiary)] hover:text-red-500"
                    aria-label="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Follow-up Questions Section */}
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="folio-h3 text-[var(--text-primary)]">Follow-up Questions</h2>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 folio-ui font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                onClick={addFollowup}
              >
                + Add
              </button>
              <button
                className="px-3 py-1.5 folio-ui font-medium text-[var(--text-primary)] bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
                onClick={reAskFollowups}
              >
                Ask
              </button>
            </div>
          </div>
          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
            {filteredFollowups.length === 0 && (
              <p className="folio-ui text-[var(--text-tertiary)] italic">
                Deeper questions based on your reflections. Click Ask to generate.
              </p>
            )}
            {filteredFollowups.map((qa, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-3 items-start p-3 rounded-lg border border-[var(--border-default)] hover:border-[var(--accent)] transition-colors"
              >
                <input
                  className="col-span-5 px-3 py-2 folio-ui border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] min-w-0 bg-[var(--bg-base)]"
                  value={qa.q || qa.question || ""}
                  placeholder="Follow-up Question"
                  onChange={(e) => setFollowup(i, "q", e.target.value)}
                />
                <textarea
                  className="col-span-6 px-3 py-2 folio-ui border border-[var(--border-default)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] resize-none bg-[var(--bg-base)]"
                  value={qa.a || qa.answer || ""}
                  placeholder="Answer"
                  rows={2}
                  onChange={(e) => setFollowup(i, "a", e.target.value)}
                />
                <button
                  className="col-span-1 px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                  onClick={() => removeFollowup(i)}
                  aria-label="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          <button
            className="px-4 py-2 folio-ui font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={saving}
            onClick={saveAnswers}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            className="px-4 py-2 folio-ui font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={regenBusy}
            onClick={() => regenerate({ overwrite: true })}
          >
            {regenBusy ? "Generating..." : "Generate Editorial"}
          </button>
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={handleStartOver}
            className="folio-ui text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline"
          >
            Start Over
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="col-span-4 space-y-6">
        {/* Editorial Draft Preview */}
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-sm">
          <h3 className="font-semibold folio-h3 text-[var(--text-primary)] mb-4">
            Editorial Draft
          </h3>
          {currentLead?.kicker || currentLead?.title ? (
            <div className="space-y-3">
              {/* Status */}
              {currentPost?.status && (
                <div className="mb-3">
                  <span
                    className={`px-2 py-1 rounded folio-meta font-medium ${
                      currentPost.status === "PUBLISHED"
                        ? "bg-green-100 text-green-800"
                        : "bg-[var(--bg-base)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {currentPost.status}
                  </span>
                </div>
              )}
              <p className="folio-body font-medium text-[var(--text-primary)]">
                {currentLead.kicker || currentLead.title}
              </p>
              {(currentLead.deck || (currentLead as any).dek) && (
                <p className="folio-ui text-[var(--text-secondary)] leading-relaxed">
                  {currentLead.deck || (currentLead as any).dek}
                </p>
              )}
              <div className="mt-4 space-y-2 folio-ui text-[var(--text-secondary)]">
                {currentSections
                  .filter((s: any) => s.type === "narrative" && s.body)
                  .slice(0, 3)
                  .map((s: any, i: number) => (
                    <p key={i} className="leading-relaxed opacity-90">
                      {s.body}
                    </p>
                  ))}
              </div>
              {currentSections.filter(
                (s: any) => s.type === "narrative" && s.body
              ).length === 0 && (
                <p className="folio-ui text-[var(--text-tertiary)] italic">
                  No narrative sections yet. Generate a draft to see preview.
                </p>
              )}
              {/* Published post link */}
              {currentPost?.status === 'PUBLISHED' && currentPost?.slug && (
                <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
                  <a
                    href={`/p/${currentPost.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="folio-ui text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1"
                  >
                    View Post <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="folio-ui text-[var(--text-tertiary)] italic">
              No editorial draft yet. Save your reflections and click "Generate Editorial" to create one.
            </p>
          )}
          {data?.drafts && data.drafts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
              <button
                className="w-full px-4 py-2 folio-ui font-medium text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg hover:bg-[var(--accent)]/20 transition-colors"
                onClick={() => router.push(`/designer/projects/${projectId}/preview`)}
              >
                View Full Preview
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Debug Modal */}
      <Dialog open={debugOpen} onOpenChange={setDebugOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Generate Debug (Dry-Run)</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-[70vh] p-4 rounded bg-[var(--bg-elevated)] border border-[var(--ridge-outer)] font-mono">
              {JSON.stringify(debugPayload, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

