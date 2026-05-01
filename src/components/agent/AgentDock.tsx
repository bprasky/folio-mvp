"use client";

import { FormEvent, useState } from "react";
import { NodeId } from "@/components/orb/timeline";

interface OrbController {
  highlightNode: (id: NodeId) => void;
  openSlide: (id: NodeId) => void;
  setTime: (t: number) => void;
  pause: () => void;
  resume: () => void;
}

interface AgentDockProps {
  orbController: OrbController;
  selectedNodeId?: NodeId | null;
}

interface OrbAgentResponse {
  text: string;
  nodes?: string[];
  edges?: string[];
  action?: {
    action: "highlightNode" | "openSlide" | "setTime" | "pause" | "resume";
    target?: string;
    value?: number;
  } | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AgentDock({ orbController, selectedNodeId }: AgentDockProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "I'm your Folio System Guide. Ask me how the flywheel works, how a node monetizes, or to highlight a specific part of the system.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      // Call the real orb agent API
      const res = await fetch("/api/orb-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmed,
          nodeId: selectedNodeId || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data: OrbAgentResponse = await res.json();

      // Apply action if present
      if (data.action) {
        const { action: actionType, target, value } = data.action;
        if (actionType === "highlightNode" && target) {
          orbController.highlightNode(target as NodeId);
        } else if (actionType === "openSlide" && target) {
          orbController.openSlide(target as NodeId);
        } else if (actionType === "setTime" && value !== undefined) {
          orbController.setTime(value);
        } else if (actionType === "pause") {
          orbController.pause();
        } else if (actionType === "resume") {
          orbController.resume();
        }
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.text,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Agent error:", error);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          "Something went wrong reaching the agent. In the future, this chat will be powered by a Folio-trained AI that can control the orb directly.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col text-xs text-slate-100 h-full min-h-0 overflow-hidden">
      <div className="border-b border-slate-800 px-4 py-3 flex-shrink-0">
        <div className="text-[var(--type-eyebrow)] uppercase tracking-[var(--ls-eyebrow)] text-slate-400 mb-1">
          System Guide
        </div>
        <div className="text-sm font-semibold">Folio Founder Agent</div>
        <p className="text-[var(--type-eyebrow)] text-slate-500 mt-1">
          Ask how the flywheel works, or which nodes drive revenue, retention,
          and defensibility.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-[var(--type-eyebrow)] leading-snug ${
                m.role === "user"
                  ? "bg-sky-500/90 text-slate-950"
                  : "bg-slate-900/80 text-slate-100 border border-slate-700"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-800 px-3 py-2.5 flex items-center gap-2 flex-shrink-0 bg-slate-950 z-10"
      >
        <input
          className="flex-1 bg-slate-900/80 border border-slate-700 rounded-full px-3 py-2 text-[var(--type-eyebrow)] outline-none focus:border-sky-500 text-slate-100"
          placeholder="Ask about a node, a loop, or how Folio earns..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={isSending}
          className="text-[var(--type-eyebrow)] px-3 py-1.5 rounded-full bg-sky-500 text-slate-950 font-medium disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

