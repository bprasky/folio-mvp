"use client";

import { useState } from "react";
import { mockVendorAnalyticsData } from "@/lib/vendorAnalyticsMock";
import { defaultDemoControls, DemoControls } from "@/lib/vendorAnalyticsDemoState";
import AnalyticsQuestionHero from "./AnalyticsQuestionHero";
import { DynamicInsightPanel } from "./DynamicInsightPanel";
import { InfluenceValueCard } from "./insight-cards/InfluenceValueCard";
import { TopEngagedDesignersCard } from "./insight-cards/TopEngagedDesignersCard";
import { EventsThatMovedMetalCard } from "./insight-cards/EventsThatMovedMetalCard";

export default function VendorAnalyticsDashboard() {
  const vendor = mockVendorAnalyticsData.vendor;
  const [controls] = useState<DemoControls>(defaultDemoControls);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [hasConversation, setHasConversation] = useState(false);

  const handleAskQuestion = (question: string) => {
    setActiveQuestion(question);
    setHasConversation(true);
  };

  return (
    <div className="min-h-screen bg-[#fdfbf8]">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              Vendor Dashboard
            </h1>
            <p className="folio-meta text-[var(--text-secondary)]">Viewing as {vendor.name}</p>
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

      {/* AI Conversation – appears only after first question */}
      {hasConversation && (
        <div className="max-w-7xl mx-auto px-6 pb-12">
          <DynamicInsightPanel
            initialQuestion={activeQuestion}
            vendorId={vendor.vendorId}
            scenarioControls={controls}
            mode="analytics"
            onConversationStart={() => setHasConversation(true)}
          />
        </div>
      )}
    </div>
  );
}
