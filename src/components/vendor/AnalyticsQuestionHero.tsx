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
            className="w-full px-6 py-5 text-lg bg-white/80 backdrop-blur rounded-2xl border border-neutral-200/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-300/50 focus:border-neutral-300 text-neutral-900 placeholder:text-neutral-400"
          />
        </div>
        <p className="mt-3 text-sm text-neutral-500 text-center">
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
              className="flex-shrink-0 px-4 py-2 text-sm rounded-full border border-neutral-200 bg-white/60 backdrop-blur text-neutral-700 hover:bg-white/80 hover:border-neutral-300 hover:shadow-sm transition-all duration-200 whitespace-nowrap"
            >
              {question}
            </button>
          ))}
          {/* Duplicate for seamless loop */}
          {suggestedQuestions.map((question, index) => (
            <button
              key={`duplicate-${index}`}
              onClick={() => handleQuestionClick(question)}
              className="flex-shrink-0 px-4 py-2 text-sm rounded-full border border-neutral-200 bg-white/60 backdrop-blur text-neutral-700 hover:bg-white/80 hover:border-neutral-300 hover:shadow-sm transition-all duration-200 whitespace-nowrap"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

