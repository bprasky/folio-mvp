"use client";

import { useState } from "react";
import { mockVendorAnalyticsData } from "@/lib/vendorAnalyticsMock";
import AnalyticsQuestionHero from "./AnalyticsQuestionHero";
import { InfluenceValueCard } from "./insight-cards/InfluenceValueCard";
import { TopEngagedDesignersCard } from "./insight-cards/TopEngagedDesignersCard";
import { EventsThatMovedMetalCard } from "./insight-cards/EventsThatMovedMetalCard";

export default function VendorAnalyticsDashboard() {
  const vendor = mockVendorAnalyticsData.vendor;
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [hasConversation, setHasConversation] = useState(false);

  const handleAskQuestion = (question: string) => {
    setActiveQuestion(question);
    setHasConversation(true);
  };

  return (
    <div className="min-h-screen bg-surface-ground">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-folio-text-primary">
              Sample vendor analytics (demo)
            </h1>
            <p className="folio-meta text-folio-text-secondary">Fictional sample data for {vendor.name}. These figures are not your account analytics.</p>
          </div>
        </div>
      </div>

      {/* Global Question Bar */}
      <div className="max-w-7xl mx-auto px-6">
        <AnalyticsQuestionHero onAskQuestion={handleAskQuestion} />
      </div>

      {/* 3 Hero Insight Cards */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <InfluenceValueCard onAskQuestion={handleAskQuestion} />
          <TopEngagedDesignersCard onAskQuestion={handleAskQuestion} />
          <EventsThatMovedMetalCard onAskQuestion={handleAskQuestion} />
        </div>
      </div>

      {/* AI conversation panel removed with the Grok chat. Placeholder keeps the
          ask flow from dead-ending until the insights engine is rebuilt. */}
      {hasConversation && (
        <div className="max-w-7xl mx-auto px-6 pb-12">
          <div className="rounded-lg border border-folio-border bg-surface-raised p-6 text-center">
            <p className="font-medium text-folio-text-primary">
              AI analytics is being rebuilt.
            </p>
            <p className="folio-meta text-folio-text-secondary mt-1">
              {activeQuestion ? `You asked: "${activeQuestion}." ` : ""}
              Conversational insights will return soon.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
