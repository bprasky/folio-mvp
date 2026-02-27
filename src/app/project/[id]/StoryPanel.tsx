"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Mic, Quote } from "lucide-react";
import { CreditsEditor } from "@/components/posting/CreditsEditor";
import type { CreditEntry } from "@/lib/posting/creditsSchema";
import { TagDiagnosticModal } from "@/components/posting/interview/TagDiagnosticModal";
import { InterviewFlow } from "@/components/interview";

type QA = {
  q?: string;
  a?: string;
  question?: string;
  answer?: string;
  questionId?: string;
  id?: string;
  section?: string;
  isFeatured?: boolean;
};

type Interview = {
  id: string;
  status?: string;
  answers?: QA[];
  followUps?: QA[];
  payload?: any;
  updatedAt?: string;
};

type DraftVersion = {
  id: string;
  createdAt: string;
  status: string;
  slug?: string;
  lead?: { kicker?: string; title?: string; deck?: string };
  sections?: any[];
};

interface StoryPanelProps {
  projectId: string;
  project: { id: string; title: string };
  images: Array<{ id: string; url: string; name: string | null }>;
  isOwner: boolean;
}

const POSTING_V1_ENABLED = process.env.NEXT_PUBLIC_POSTING_V1 === "true";

export default function StoryPanel({ projectId, project, images, isOwner }: StoryPanelProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [answers, setAnswers] = useState<QA[]>([]);
  const [followups, setFollowups] = useState<QA[]>([]);
  const [saving, setSaving] = useState(false);

  // Credits state
  const [credits, setCredits] = useState<CreditEntry[]>([]);
  const [creditsSaving, setCreditsSaving] = useState(false);

  // Interview modal state
  const [showTagDiagnostic, setShowTagDiagnostic] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);

  // Deduplicate answers by question and answer content
  const dedupeAnswers = (answers: QA[]): QA[] => {
    const seen = new Map<string, QA>();
    for (const qa of answers) {
      const answerKey = (qa.a || qa.answer || "").toLowerCase().trim().slice(0, 50);
      const questionKey = (qa.q || qa.question || "").toLowerCase().trim();
      const key = `${questionKey}::${answerKey}`;
      if (key && key !== "::" && !seen.has(key)) {
        seen.set(key, qa);
      }
    }
    return Array.from(seen.values());
  };

  // Fetch interview data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/posting/project/${projectId}/drafts`);
      if (res.ok) {
        const result = await res.json();

        let answersFromDrafts = result.interview?.answers || [];
        let followUpsFromDrafts = result.interview?.followUps || [];

        // Fallback: try interview GET endpoint
        if (answersFromDrafts.length === 0) {
          try {
            const interviewRes = await fetch(`/api/posting/project/${projectId}/interview`);
            if (interviewRes.ok) {
              const interviewData = await interviewRes.json();
              if (interviewData.answers?.length > 0) {
                answersFromDrafts = interviewData.answers;
              }
              if (interviewData.followUps?.length > 0 && followUpsFromDrafts.length === 0) {
                followUpsFromDrafts = interviewData.followUps;
              }
            }
          } catch (fallbackErr) {
            console.warn("[StoryPanel] Fallback interview fetch failed:", fallbackErr);
          }
        }

        if (answersFromDrafts.length > 0) {
          const mappedAnswers = answersFromDrafts.map((a: any) => ({
            q: a.question || a.q || a.prompt || "",
            a: a.answer || a.a || "",
            question: a.question || a.q || a.prompt || "",
            answer: a.answer || a.a || "",
            questionId: a.questionId || a.id,
            section: a.section,
            isFeatured: !!a.isFeatured,
          }));
          setAnswers(dedupeAnswers(mappedAnswers));
        } else {
          setAnswers([]);
        }

        if (followUpsFromDrafts.length > 0) {
          setFollowups(
            followUpsFromDrafts.map((f: any) => ({
              q: f.question || f.q || f.prompt || "",
              a: f.answer || f.a || "",
              question: f.question || f.q || f.prompt || "",
              answer: f.answer || f.a || "",
            }))
          );
        } else {
          setFollowups([]);
        }
      }
    } catch (error) {
      console.error("[StoryPanel] Fetch failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch credits
  const fetchCredits = async () => {
    try {
      const res = await fetch(`/api/posting/project/${projectId}/credits`);
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits || []);
      }
    } catch (error) {
      console.error("[StoryPanel] Credits fetch failed:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchCredits();
  }, [projectId]);

  const filteredAnswers = answers.filter(
    (qa) => (qa.q || qa.question || "").trim() || (qa.a || qa.answer || "").trim()
  );
  const filteredFollowups = followups.filter(
    (qa) => (qa.q || qa.question || "").trim() || (qa.a || qa.answer || "").trim()
  );

  async function saveAnswers() {
    try {
      setSaving(true);
      const res = await fetch(`/api/posting/project/${projectId}/interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: filteredAnswers.map((qa) => ({
            questionId: qa.questionId || qa.q || qa.question,
            answer: qa.a || qa.answer || "",
            question: qa.q || qa.question || "",
            isFeatured: !!qa.isFeatured,
          })),
          followUps: filteredFollowups.map((qa) => ({
            question: qa.q || qa.question || "",
            answer: qa.a || qa.answer || "",
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
      console.error("[StoryPanel] Save failed", error);
      alert("Failed to save answers");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreditsChange(newCredits: CreditEntry[]) {
    setCredits(newCredits);
    setCreditsSaving(true);
    try {
      const res = await fetch(`/api/posting/project/${projectId}/credits`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: newCredits }),
      });
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits || newCredits);
      }
    } catch (error) {
      console.error("[StoryPanel] Credits save failed:", error);
    } finally {
      setCreditsSaving(false);
    }
  }

  async function reAskFollowups() {
    try {
      const res = await fetch(`/api/posting/project/${projectId}/interview/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: filteredAnswers.map((qa) => ({
            questionId: qa.questionId || qa.q || `fallback-${Math.random()}`,
            answer: qa.a,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate follow-ups");
      }

      const result = await res.json();
      const newFollowups =
        result.followups?.map((f: any) => ({
          q: f.text || f.question || f.prompt || "",
          a: f.answer || "",
          questionId: f.questionId,
        })) ?? [];

      setFollowups((prev) => [...prev, ...newFollowups]);
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
      ...(key === "a" ? { answer: value } : {}),
      ...(key === "q" ? { question: value } : {}),
    };
    setAnswers(next);
  }

  function addAnswer() {
    setAnswers([...answers, { q: "", a: "" }]);
  }

  function removeAnswer(i: number) {
    setAnswers(answers.filter((_, idx) => idx !== i));
  }

  function toggleFeatured(i: number) {
    const next = [...answers];
    next[i] = { ...next[i], isFeatured: !next[i].isFeatured };
    setAnswers(next);
  }

  function setFollowup(i: number, key: "q" | "a", value: string) {
    const next = [...followups];
    next[i] = {
      ...next[i],
      [key]: value,
      ...(key === "a" ? { answer: value } : {}),
      ...(key === "q" ? { question: value } : {}),
    };
    setFollowups(next);
  }

  function addFollowup() {
    setFollowups([...followups, { q: "", a: "" }]);
  }

  function removeFollowup(i: number) {
    setFollowups(followups.filter((_, idx) => idx !== i));
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Intro */}
      <p className="folio-body text-[var(--text-secondary)]">
        Tell us about this project. Your reflections and credits shape the published post.
      </p>

      {/* Project Credits */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-sm">
        <h2 className="folio-h3 text-[var(--text-primary)] mb-1">Project Credits</h2>
        <p className="folio-meta text-[var(--text-tertiary)] mb-4">
          Who else brought this project to life? Credits appear on your published post.
        </p>
        <CreditsEditor
          credits={credits}
          onChange={handleCreditsChange}
          saving={creditsSaving}
        />
      </div>

      {/* Continue to Interview CTA */}
      {isOwner && POSTING_V1_ENABLED && (
        <button
          onClick={() => setShowTagDiagnostic(true)}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[var(--accent)] text-white rounded-2xl hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
        >
          <Mic className="w-5 h-5" />
          <div className="text-left">
            <span className="folio-ui font-semibold block">Continue to Interview</span>
            <span className="folio-meta opacity-80">Answer questions about your design decisions</span>
            <span className="folio-meta opacity-60 text-xs block mt-0.5">
              Your answers will update the draft. Regenerate and republish to apply changes.
            </span>
          </div>
        </button>
      )}

      {/* Your Reflections Section */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="folio-h3 text-[var(--text-primary)]">Your Reflections</h2>
          <button
            className="px-3 py-1.5 folio-ui font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
            onClick={addAnswer}
          >
            + Add
          </button>
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
              className={`rounded-lg p-4 mb-3 transition-colors ${
                qa.isFeatured
                  ? "border-l-4 border-l-[var(--accent)] border border-[var(--accent)]/30 bg-[var(--accent)]/5"
                  : "border border-[var(--border-default)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <label className="block folio-ui font-medium text-[var(--text-primary)]">
                  {qa.q || qa.question || "Your reflection"}
                </label>
                <button
                  onClick={() => toggleFeatured(i)}
                  className={`shrink-0 p-1.5 rounded transition-colors ${
                    qa.isFeatured
                      ? "text-[var(--accent)] bg-[var(--accent)]/10"
                      : "text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5"
                  }`}
                  aria-label={qa.isFeatured ? "Remove from featured quotes" : "Mark as featured quote"}
                  title={qa.isFeatured ? "Featured quote" : "Feature this quote"}
                >
                  <Quote className="w-4 h-4" />
                </button>
              </div>
              {qa.isFeatured && (
                <div className="mb-2 pl-3 border-l-2 border-[var(--accent)]/40">
                  <p className="folio-ui italic text-[var(--text-secondary)] leading-relaxed">
                    {qa.a || qa.answer || ""}
                  </p>
                </div>
              )}
              <textarea
                value={qa.a || qa.answer || ""}
                onChange={(e) => setAnswer(i, "a", e.target.value)}
                className={`w-full min-h-[80px] p-2 border border-[var(--border-default)] rounded folio-ui resize-y bg-[var(--bg-base)] focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] ${
                  qa.isFeatured ? "min-h-[60px]" : ""
                }`}
                placeholder="Share your thoughts..."
              />
              <div className="flex items-center justify-between mt-2">
                {qa.isFeatured && (
                  <span className="folio-meta text-[var(--accent)] font-medium">
                    Pull quote
                  </span>
                )}
                <div className="flex-1" />
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
                className="col-span-5 px-3 py-2 folio-ui border border-[var(--border-default)] rounded-lg focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] min-w-0 bg-[var(--bg-base)]"
                value={qa.q || qa.question || ""}
                placeholder="Follow-up Question"
                onChange={(e) => setFollowup(i, "q", e.target.value)}
              />
              <textarea
                className="col-span-6 px-3 py-2 folio-ui border border-[var(--border-default)] rounded-lg focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] resize-none bg-[var(--bg-base)]"
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

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          className="px-4 py-2 folio-ui font-medium text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={saving}
          onClick={saveAnswers}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Tag Diagnostic Modal */}
      {showTagDiagnostic && (
        <TagDiagnosticModal
          open={showTagDiagnostic}
          onOpenChange={(open) => setShowTagDiagnostic(open)}
          projectId={project.id}
          onAutoTagComplete={() => router.refresh()}
          onStartInterview={() => {
            setShowTagDiagnostic(false);
            setShowInterviewModal(true);
          }}
        />
      )}

      {/* Interview Flow Modal */}
      {showInterviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowInterviewModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden">
            <InterviewFlow
              projectId={project.id}
              projectName={project.title}
              images={images.map((img) => ({ id: img.id, url: img.url, name: img.name }))}
              onComplete={() => {
                setShowInterviewModal(false);
                router.push(`/designer/projects/${project.id}/preview`);
              }}
              onCancel={() => setShowInterviewModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
