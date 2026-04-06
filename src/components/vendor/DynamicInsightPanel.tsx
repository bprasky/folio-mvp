"use client";

import { useEffect, useState } from "react";
import { VisualizationSpec } from "@/lib/vendorAnalyticsVisualization";
import { AnalyticsVisualization } from "./AnalyticsVisualization";
import {
  folioVendorActions,
  FolioVendorAction,
} from "@/lib/folioVendorCapabilities";
import { DemoControls } from "@/lib/vendorAnalyticsDemoState";
import { ChatMode, VendorAnalyticsChatMessage } from "@/app/api/vendor-analytics/chat/route";
import { CreateAppreciationDinnerModal } from "./actions/CreateAppreciationDinnerModal";
import { CreateDiscoveryLunchModal } from "./actions/CreateDiscoveryLunchModal";

export interface AnalyticsMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ActionAssets {
  designerNames?: string[];
  segmentName?: string;
  segmentDescription?: string;
  eventConcept?: {
    title: string;
    format: string;
    locationHint?: string;
    timingHint?: string;
  };
  draftInviteText?: string;
  sessionAgenda?: string[];
  productNames?: string[];
  boardTitle?: string;
  boardDescription?: string;
  reportTitle?: string;
  reportOutline?: string[];
  educationalContentBlocks?: string[];
  boostSettings?: Record<string, unknown>;
}

export interface AnalyticsAnswer {
  answer: string;
  visualization?: VisualizationSpec;
  followUpQuestions?: string[];
  actions?: {
    actionId: string;
    label?: string;
    reason: string;
    assets?: ActionAssets;
  }[];
}

interface DynamicInsightPanelProps {
  initialQuestion: string | null;
  vendorId: string;
  scenarioControls: DemoControls;
  mode?: "analytics" | "strategy";
  onConversationStart?: () => void;
}

const askAnalyticsQuestion = async (
  vendorId: string,
  mode: "analytics" | "strategy",
  messages: AnalyticsMessage[],
  scenarioControls: DemoControls
): Promise<AnalyticsAnswer> => {
  const payload = {
    vendorId,
    mode,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    scenarioControls,
  };

  const res = await fetch("/api/vendor-analytics/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ answer: "Unknown error" }));
    throw new Error(errorData.answer || `Failed to fetch analytics answer (${res.status})`);
  }

  return (await res.json()) as AnalyticsAnswer;
};

interface ActiveActionState {
  action: FolioVendorAction;
  reason: string;
}

export const DynamicInsightPanel: React.FC<DynamicInsightPanelProps> = ({
  initialQuestion,
  vendorId,
  scenarioControls,
  mode = "analytics",
  onConversationStart,
}) => {
  const [messages, setMessages] = useState<AnalyticsMessage[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<AnalyticsAnswer | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [followupInput, setFollowupInput] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveActionState | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [showAppreciationDinnerModal, setShowAppreciationDinnerModal] = useState(false);
  const [showDiscoveryLunchModal, setShowDiscoveryLunchModal] = useState(false);

  // Trigger when initialQuestion changes
  useEffect(() => {
    if (!initialQuestion) return;

    const newMsg: AnalyticsMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: initialQuestion,
    };

    const run = async () => {
      try {
        setIsLoading(true);
        setCurrentAnswer(null);
        setError(null);
        setMessages([newMsg]);
        onConversationStart?.();

        const answer = await askAnalyticsQuestion(
          vendorId,
          mode,
          [newMsg],
          scenarioControls
        );
        setCurrentAnswer(answer);

        const assistantMsg: AnalyticsMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: answer.answer,
        };

        setMessages([newMsg, assistantMsg]);
      } catch (e) {
        console.error(e);
        const errorMessage = e instanceof Error ? e.message : "Failed to get analytics answer";
        setError(errorMessage);
        setCurrentAnswer({
          answer: errorMessage,
          visualization: {
            type: "stat",
            title: "Error",
            primaryStatLabel: "Status",
            primaryStatValue: "Failed",
          },
          followUpQuestions: [],
          actions: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [initialQuestion, vendorId, mode, scenarioControls]);

  const handleFollowUp = async (content?: string) => {
    const question = (content ?? followupInput).trim();
    if (!question) return;

    const userMsg: AnalyticsMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setFollowupInput("");

    try {
      setIsLoading(true);
      setError(null);
      const answer = await askAnalyticsQuestion(
        vendorId,
        mode,
        nextMessages,
        scenarioControls
      );
      setCurrentAnswer(answer);

      const assistantMsg: AnalyticsMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer.answer,
      };

      setMessages([...nextMessages, assistantMsg]);
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : "Failed to get analytics answer";
      setError(errorMessage);
      setCurrentAnswer({
        answer: errorMessage,
        visualization: {
          type: "stat",
          title: "Error",
          primaryStatLabel: "Status",
          primaryStatValue: "Failed",
        },
        followUpQuestions: [],
        actions: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openActionWorkflow = (actionId: string, reason: string) => {
    const meta = folioVendorActions.find((a) => a.id === actionId);
    if (!meta) return;
    
    // Open specific modals for event creation actions
    if (actionId === "create_appreciation_dinner") {
      setShowAppreciationDinnerModal(true);
      return;
    }
    if (actionId === "create_discovery_lunch") {
      setShowDiscoveryLunchModal(true);
      return;
    }
    
    // For other actions, show the generic workflow drawer
    setActiveAction({ action: meta, reason });
  };

  const lastUserMessage = messages.filter((m) => m.role === "user").slice(-1)[0];

  return (
    <>
      <section className="mt-4 ridge-card p-4">
        <header className="flex items-center justify-between gap-2">
          <h2 className="folio-ui font-semibold text-folio-text-primary">
            {mode === "strategy" ? "AI Strategy Session" : "Analytics Conversation"}
          </h2>
          {mode === "analytics" && (
            <p className="text-[11px] uppercase tracking-wide text-folio-text-tertiary">
              Ask anything about your events, products, designers, or projects.
            </p>
          )}
        </header>

        {messages.length === 0 && !isLoading && (
          <p className="mt-3 folio-ui text-folio-text-secondary">
            Ask a question above or click a suggested question to start a
            conversation about your data.
          </p>
        )}

        {lastUserMessage && (
          <div className="mt-4 flex justify-end">
            <div className="max-w-xl rounded-2xl bg-[var(--text-primary)] px-3 py-2 text-sm text-[var(--bg-base)]">
              {lastUserMessage.content}
            </div>
          </div>
        )}

        {currentAnswer && (
          <div className="mt-3">
            {currentAnswer.answer && (
              <div className={`max-w-xl rounded-2xl px-3 py-2 text-sm ${
                error
                  ? "bg-red-50 border border-red-200 text-red-800"
                  : "bg-surface-ground text-folio-text-primary"
              }`}>
                <p style={{ whiteSpace: "pre-line" }}>
                  {currentAnswer.answer}
                </p>
              </div>
            )}

            {currentAnswer.visualization && (
              <div className="mt-3 max-w-xl">
                <AnalyticsVisualization spec={currentAnswer.visualization} />
              </div>
            )}

            {currentAnswer.actions && currentAnswer.actions.length > 0 && (
              <div className="mt-4 max-w-xl border-t border-folio-border-subtle pt-3">
                <p className="folio-meta font-semibold uppercase tracking-wide text-folio-text-secondary">
                  Suggested Folio actions
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentAnswer.actions.map((a) => {
                    const meta = folioVendorActions.find(
                      (fa) => fa.id === a.actionId
                    );
                    const label = a.label ?? meta?.label ?? a.actionId;
                    return (
                      <button
                        key={a.actionId + a.reason}
                        type="button"
                        onClick={() => openActionWorkflow(a.actionId, a.reason)}
                        className="rounded-full border border-folio-border-subtle bg-surface-canvas/80 px-3 py-1 folio-meta text-folio-text-primary hover:bg-surface-ground"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <ul className="mt-2 space-y-1">
                  {currentAnswer.actions.map((a) => {
                    const meta = folioVendorActions.find(
                      (fa) => fa.id === a.actionId
                    );
                    const label = a.label ?? meta?.label ?? a.actionId;
                    return (
                      <li
                        key={a.actionId + "_reason"}
                        className="text-[11px] text-folio-text-secondary"
                      >
                        <span className="font-medium">{label}</span>
                        {": "}
                        {a.reason}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {currentAnswer.followUpQuestions &&
              currentAnswer.followUpQuestions.length > 0 && (
                <div className="mt-4 max-w-xl">
                  <p className="folio-meta font-semibold uppercase tracking-wide text-folio-text-secondary">
                    Suggested follow-ups
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentAnswer.followUpQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleFollowUp(q)}
                        className="rounded-full border border-folio-border-subtle bg-surface-canvas/80 px-3 py-1 folio-meta text-folio-text-primary hover:bg-surface-ground"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}

        {isLoading && (
          <p className="mt-3 folio-meta text-folio-text-secondary">Thinking with your data...</p>
        )}

        {/* Follow-up input */}
        <form
          className="mt-4 flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleFollowUp();
          }}
        >
          <input
            type="text"
            value={followupInput}
            onChange={(e) => setFollowupInput(e.target.value)}
            placeholder="Ask a follow-up question..."
            className="flex-1 rounded-full border border-folio-border-subtle bg-surface-canvas/70 px-3 py-2 text-sm text-folio-text-primary placeholder:text-folio-text-tertiary focus:border-folio-border-subtle focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-full bg-[var(--text-primary)] px-4 py-2 folio-meta font-medium text-[var(--bg-base)] hover:opacity-90"
          >
            Ask
          </button>
        </form>
      </section>

      {/* Micro-workflow drawer */}
      {activeAction && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-md bg-surface-canvas shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-folio-border-subtle px-4 py-3">
              <div>
                <p className="folio-meta uppercase tracking-wide text-folio-text-tertiary">
                  Folio action
                </p>
                <h3 className="folio-ui font-semibold text-folio-text-primary">
                  {activeAction.action.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveAction(null)}
                className="text-folio-text-tertiary hover:text-folio-text-primary text-lg"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 text-sm text-folio-text-primary space-y-4">
              <p className="text-folio-text-secondary">
                {activeAction.action.description}
              </p>
              <p className="folio-meta text-folio-text-secondary">
                Why now: {activeAction.reason}
              </p>

              {/* Mock micro-workflow steps based on category */}
              {activeAction.action.category === "events" && (
                <div className="space-y-3">
                  <p className="font-medium text-folio-text-primary">
                    Step 1 — Choose the event or projects to focus on
                  </p>
                  <p className="text-sm text-folio-text-secondary">
                    In a full implementation, this step would list the events
                    and projects that drove the metrics we just discussed so you
                    can confirm what to boost or recap.
                  </p>
                  <p className="font-medium text-folio-text-primary">
                    Step 2 — Confirm target designer segment
                  </p>
                  <p className="text-sm text-folio-text-secondary">
                    Folio will use your engagement data to propose a guest list
                    or audience segment and show you a preview before sending
                    invitations or highlighting content.
                  </p>
                </div>
              )}

              {activeAction.action.category === "products" && (
                <div className="space-y-3">
                  <p className="font-medium text-folio-text-primary">
                    Step 1 — Review suggested SKUs
                  </p>
                  <p className="text-sm text-folio-text-secondary">
                    Here you would see the SKUs that the AI identified as top
                    candidates for boosting or monitoring, drawn directly from
                    your analytics.
                  </p>
                  <p className="font-medium text-folio-text-primary">
                    Step 2 — Choose how to highlight them
                  </p>
                  <p className="text-sm text-folio-text-secondary">
                    Options could include boosted discovery placement, a
                    curated board, or inclusion in upcoming event materials.
                  </p>
                </div>
              )}

              {activeAction.action.category === "designers" && (
                <div className="space-y-3">
                  <p className="font-medium text-folio-text-primary">
                    Step 1 — Preview designer segment
                  </p>
                  <p className="text-sm text-folio-text-secondary">
                    Folio would show you the designers selected for this
                    segment—based on engagement, alignment, and project value—
                    so you can refine the list.
                  </p>
                  <p className="font-medium text-folio-text-primary">
                    Step 2 — Decide next touchpoint
                  </p>
                  <p className="text-sm text-folio-text-secondary">
                    In the full product, you could connect this segment to
                    boards, invitations, or upcoming events with one click.
                  </p>
                </div>
              )}

              {activeAction.action.category === "editorial" && (
                <div className="space-y-3">
                  <p className="font-medium text-folio-text-primary">
                    Step 1 — Select projects or boards to feature
                  </p>
                  <p className="text-sm text-folio-text-secondary">
                    Here you would confirm which projects or boards should be
                    boosted in the feed or featured on your profile.
                  </p>
                  <p className="font-medium text-folio-text-primary">
                    Step 2 — Confirm placement and timing
                  </p>
                  <p className="text-sm text-folio-text-secondary">
                    You would then choose how prominently and for how long
                    these assets should appear in Folio surfaces.
                  </p>
                </div>
              )}

              {activeAction.action.category === "analytics" && (
                <div className="space-y-3">
                  <p className="font-medium text-folio-text-primary">
                    Step 1 — Define what to track
                  </p>
                  <p className="text-sm text-folio-text-secondary">
                    This step would let you choose events, SKUs, or segments
                    that should be monitored in a saved report or watchlist.
                  </p>
                  <p className="font-medium text-folio-text-primary">
                    Step 2 — Choose cadence and format
                  </p>
                  <p className="text-sm text-folio-text-secondary">
                    In the full implementation, you could choose how often you
                    want updates and in what format (dashboard card, export,
                    email summary, etc.).
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-folio-border-subtle px-4 py-3">
              <button
                type="button"
                className="w-full rounded-full bg-[var(--text-primary)] py-2 folio-meta font-medium text-[var(--bg-base)] hover:opacity-90"
                onClick={() => setActiveAction(null)}
              >
                Close (mocked flow for now)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Creation Modals */}
      <CreateAppreciationDinnerModal
        open={showAppreciationDinnerModal}
        onClose={() => setShowAppreciationDinnerModal(false)}
        vendorId={vendorId}
      />
      <CreateDiscoveryLunchModal
        open={showDiscoveryLunchModal}
        onClose={() => setShowDiscoveryLunchModal(false)}
        vendorId={vendorId}
      />
    </>
  );
};
