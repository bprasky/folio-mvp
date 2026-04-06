"use client";

import { useState, useRef, useEffect } from "react";

interface AnalyticsQuestionHeroProps {
  onAskQuestion: (question: string) => void;
}

const suggestedQuestions = [
  "Which designers are most engaged with my products?",
  "Which events actually produced real demand?",
  "Which SKUs should I double down on next quarter?",
  "What is my current influence value across active projects?",
  "Which products are trending up or down?",
  "How effective were my recent events?",
];

export default function AnalyticsQuestionHero({ onAskQuestion }: AnalyticsQuestionHeroProps) {
  const [inputValue, setInputValue] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onAskQuestion(inputValue.trim());
      setInputValue("");
    }
  };

  const handleQuestionClick = (question: string) => {
    onAskQuestion(question);
    setInputValue("");
  };

  // Auto-scroll the question chips
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollPosition = 0;
    const scrollSpeed = 0.5; // pixels per frame

    const scroll = () => {
      scrollPosition += scrollSpeed;
      if (scrollPosition >= container.scrollWidth - container.clientWidth) {
        scrollPosition = 0;
      }
      container.scrollLeft = scrollPosition;
      requestAnimationFrame(scroll);
    };

    const animationId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div className="w-full space-y-6">
      {/* Hero Input */}
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask anything about your data…"
            className="w-full px-6 py-5 text-lg bg-surface-canvas/80 backdrop-blur rounded-2xl border border-folio-border-subtle shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--ridge-outer)] focus:border-folio-border-subtle text-folio-text-primary placeholder:text-folio-text-tertiary"
          />
        </div>
        <p className="mt-3 folio-ui text-folio-text-secondary text-center">
          Tell me what you want to know about events, products, designers, or projects.
        </p>
      </form>

      {/* Suggested Questions Chips */}
      <div className="relative overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide"
        >
          {suggestedQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleQuestionClick(question)}
              className="flex-shrink-0 px-4 py-2 text-sm rounded-full border border-folio-border-subtle bg-surface-canvas/60 backdrop-blur text-folio-text-primary hover:bg-surface-canvas/80 hover:border-folio-border-subtle hover:shadow-sm transition-all duration-200 whitespace-nowrap"
            >
              {question}
            </button>
          ))}
          {/* Duplicate for seamless loop */}
          {suggestedQuestions.map((question, index) => (
            <button
              key={`duplicate-${index}`}
              onClick={() => handleQuestionClick(question)}
              className="flex-shrink-0 px-4 py-2 text-sm rounded-full border border-folio-border-subtle bg-surface-canvas/60 backdrop-blur text-folio-text-primary hover:bg-surface-canvas/80 hover:border-folio-border-subtle hover:shadow-sm transition-all duration-200 whitespace-nowrap"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

