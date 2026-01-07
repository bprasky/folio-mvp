"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSceneState,
  NodeId,
  SceneState,
  EdgeId,
} from "@/components/orb/timeline";
import { OrbScene } from "@/components/orb/OrbScene";
import { ConstellationScene } from "@/components/orb/ConstellationScene";
import { NodeSlidePanel } from "@/components/orb/NodeSlidePanel";
import { EdgePanel } from "@/components/orb/EdgePanel";
import { NODE_SLIDES, NodeSlide } from "@/components/orb/nodeSlides";
import { AgentDock } from "@/components/agent/AgentDock";
import { PRESENT_STEPS, type PresentStep } from "@/components/orb/presentScript";

const LOOP_DURATION = 60; // seconds

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export default function SimulationClient() {
  const [time, setTime] = useState(0);
  const [mode, setMode] = useState<"simulation" | "explore" | "present">(
    "simulation"
  );
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<EdgeId | null>(null);
  const [isSimulationPaused, setIsSimulationPaused] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const [faqsForNode, setFaqsForNode] = useState<FAQItem[]>([]);
  const [viewMode, setViewMode] = useState<"orb" | "constellation">("orb");

  useEffect(() => {
    let frameId: number;
    let start = performance.now();

    const loop = (now: number) => {
      const elapsedSec = (now - start) / 1000;
      const t = elapsedSec % LOOP_DURATION;
      if (!isSimulationPaused && mode === "simulation") {
        setTime(t);
      }
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isSimulationPaused, mode]);

  const sceneState: SceneState = useMemo(() => getSceneState(time), [time]);
  const selectedSlide: NodeSlide | null = selectedNodeId
    ? NODE_SLIDES[selectedNodeId]
    : null;

  // Fetch FAQs when selectedNodeId changes
  useEffect(() => {
    if (!selectedNodeId) {
      setFaqsForNode([]);
      return;
    }

    const fetchFAQs = async () => {
      try {
        const res = await fetch(`/api/orb-faqs?nodeId=${selectedNodeId}`);
        if (res.ok) {
          const data = await res.json();
          setFaqsForNode(data.faqs || []);
        }
      } catch (error) {
        console.error("Failed to fetch FAQs:", error);
        setFaqsForNode([]);
      }
    };

    fetchFAQs();
  }, [selectedNodeId]);

  const currentPresentStep: PresentStep | null =
    mode === "present" ? PRESENT_STEPS[presentIndex] ?? PRESENT_STEPS[0] : null;

  const goToPresentStep = (index: number) => {
    const clamped = Math.max(0, Math.min(PRESENT_STEPS.length - 1, index));
    const step = PRESENT_STEPS[clamped];
    setPresentIndex(clamped);
    setTime(step.time);
    setSelectedNodeId(step.focusNode ?? null);
    setSelectedEdgeId(step.focusEdge ?? null);
  };

  const handleNodeSelect = (id: NodeId) => {
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    if (mode !== "present") {
      setMode("explore");
    }
  };

  const handleEdgeSelect = (id: EdgeId) => {
    setSelectedEdgeId(id);
    setSelectedNodeId(null);
    if (mode !== "present") {
      setMode("explore");
    }
  };

  // Orb "controller" object passed down to AgentDock for future control
  const orbController = {
    highlightNode: (id: NodeId) => {
      setSelectedNodeId(id);
      setMode("explore");
    },
    openSlide: (id: NodeId) => {
      setSelectedNodeId(id);
      setMode("explore");
    },
    setTime: (t: number) => {
      const mod = ((t % LOOP_DURATION) + LOOP_DURATION) % LOOP_DURATION;
      setTime(mod);
    },
    pause: () => setIsSimulationPaused(true),
    resume: () => setIsSimulationPaused(false),
  };

  return (
    <div className="w-full h-screen bg-black text-slate-50 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur flex-shrink-0">
        <div className="flex flex-col">
          <span className="text-sm font-medium tracking-tight">
            Folio System Orb
          </span>
          <span className="text-[11px] text-slate-400">
            Start with a few actions. Watch the ecosystem grow.
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">View</span>
            <button
              className={`px-2 py-1 rounded-full border text-[11px] ${
                viewMode === "orb"
                  ? "bg-slate-100 text-slate-900 border-slate-100"
                  : "bg-slate-900 text-slate-300 border-slate-700"
              }`}
              onClick={() => setViewMode("orb")}
            >
              Orb
            </button>
            <button
              className={`px-2 py-1 rounded-full border text-[11px] ${
                viewMode === "constellation"
                  ? "bg-slate-100 text-slate-900 border-slate-100"
                  : "bg-slate-900 text-slate-300 border-slate-700"
              }`}
              onClick={() => setViewMode("constellation")}
            >
              Constellation
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Mode</span>
            <button
              className={`px-2 py-1 rounded-full border text-[11px] ${
                mode === "simulation"
                  ? "bg-slate-100 text-slate-900 border-slate-100"
                  : "bg-slate-900 text-slate-300 border-slate-700"
              }`}
              onClick={() => {
                setMode("simulation");
                setIsSimulationPaused(false);
              }}
            >
              Simulation
            </button>
            <button
              className={`px-2 py-1 rounded-full border text-[11px] ${
                mode === "explore"
                  ? "bg-slate-100 text-slate-900 border-slate-100"
                  : "bg-slate-900 text-slate-300 border-slate-700"
              }`}
              onClick={() => {
                setMode("explore");
                setIsSimulationPaused(true);
              }}
            >
              Explore
            </button>
            <button
              className={`px-2 py-1 rounded-full border text-[11px] ${
                mode === "present"
                  ? "bg-sky-500 text-slate-950 border-sky-500"
                  : "bg-slate-900 text-slate-300 border-slate-700"
              }`}
              onClick={() => {
                setMode("present");
                setIsSimulationPaused(true);
                goToPresentStep(0);
              }}
            >
              Present
            </button>
          </div>
          <div className="hidden md:flex items-center text-[11px] text-slate-500">
            <span className="mr-1">Time:</span>
            <span className="font-mono">
              {String(time.toFixed(1)).padStart(5, " ")}s
            </span>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0">
        {/* Orb/Constellation + metrics */}
        <div className="relative flex-1 min-h-[640px] overflow-hidden">
          {mode === "present" && currentPresentStep && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 max-w-xl bg-slate-950/90 border border-slate-800 rounded-2xl px-4 py-3 shadow-lg">
              <div className="flex items-center justify-between gap-4 mb-1">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  Step {currentPresentStep.index + 1} of {PRESENT_STEPS.length}
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    className="px-2 py-1 rounded-full border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
                    disabled={presentIndex === 0}
                    onClick={() => goToPresentStep(presentIndex - 1)}
                  >
                    Prev
                  </button>
                  <button
                    className="px-2 py-1 rounded-full border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
                    disabled={presentIndex === PRESENT_STEPS.length - 1}
                    onClick={() => goToPresentStep(presentIndex + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
              <div className="text-sm font-semibold text-slate-50">
                {currentPresentStep.label}
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                {currentPresentStep.caption}
              </p>
            </div>
          )}

          {viewMode === "orb" ? (
            <OrbScene
              state={sceneState}
              time={time}
              selectedNode={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onNodeSelect={handleNodeSelect}
              onEdgeSelect={handleEdgeSelect}
              mode={mode}
            />
          ) : (
            <ConstellationScene
              state={sceneState}
              time={time}
              selectedNode={selectedNodeId}
              selectedEdge={selectedEdgeId}
              onNodeSelect={handleNodeSelect}
              onEdgeSelect={handleEdgeSelect}
              mode={mode}
            />
          )}
        </div>

        {/* Node slide panel / Edge panel */}
        <div className="hidden lg:block w-[340px] border-l border-slate-800 bg-slate-950/90 flex flex-col overflow-hidden">
          {selectedEdgeId ? (
            <EdgePanel edgeId={selectedEdgeId} />
          ) : selectedSlide && selectedNodeId ? (
            <NodeSlidePanel
              slide={selectedSlide}
              nodeId={selectedNodeId}
              faqs={faqsForNode}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center px-6 text-center text-[11px] text-slate-500">
              Click any node to see its role in the system, or click a connection to focus on just that relationship.
            </div>
          )}
        </div>

        {/* Agent dock */}
        <div className="w-[320px] border-l border-slate-800 bg-slate-950/95 flex flex-col overflow-hidden min-h-0">
          <AgentDock orbController={orbController} selectedNodeId={selectedNodeId} />
        </div>
      </div>

      {/* For small screens, slide panel could be a future enhancement */}
    </div>
  );
}

