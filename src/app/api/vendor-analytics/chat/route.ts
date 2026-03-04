export const dynamic = 'force-dynamic';

// Grok-4 powered – Folio voice locked in – Nov 21 2025

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import {
  VendorAnalyticsData,
  mockVendorAnalyticsData,
} from "@/lib/vendorAnalyticsMock";
import { VisualizationSpec } from "@/lib/vendorAnalyticsVisualization";
import { folioVendorActions } from "@/lib/folioVendorCapabilities";
import {
  DemoControls,
  defaultDemoControls,
  applyDemoControls,
} from "@/lib/vendorAnalyticsDemoState";
import {
  classifyVendorQuestion,
  IntentCategory,
  LikelyGoal,
} from "@/lib/vendorIntentInterceptor";
import { FOLIO_GROK_SYSTEM_PROMPT } from "@/lib/folioGrokSystemPrompt";

type ChatRole = "user" | "assistant" | "system";

export interface VendorAnalyticsChatMessage {
  role: ChatRole;
  content: string;
}

export type ChatMode = "analytics" | "strategy";

interface VendorAnalyticsChatRequest {
  vendorId: string;
  mode?: ChatMode; // default "analytics"
  messages: VendorAnalyticsChatMessage[];
  scenarioControls?: DemoControls;
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

export interface VendorAnalyticsChatActionSuggestion {
  actionId: string;  // must match one of folioVendorActions.id
  label?: string;    // optional override label
  reason: string;    // why this is recommended
  assets?: ActionAssets;  // concrete assets generated for this action
}

interface VendorAnalyticsChatResponse {
  answer: string;
  visualization?: VisualizationSpec;
  followUpQuestions?: string[];
  actions?: VendorAnalyticsChatActionSuggestion[];
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as VendorAnalyticsChatRequest;

    const mode: ChatMode = body.mode ?? "analytics";
    const vendorId = body.vendorId;

    // For now we ignore vendorId and always use our single mock dataset.
    let data: VendorAnalyticsData = mockVendorAnalyticsData;

    const controls = body.scenarioControls ?? defaultDemoControls;
    data = applyDemoControls(data, controls);

    const dataSummary = JSON.stringify(data);
    const capabilitiesSummary = JSON.stringify(folioVendorActions);

    // Extract last user question (if available) to classify intent
    const lastUserMessage = [...body.messages]
      .reverse()
      .find((m) => m.role === "user");

    let detectedIntent: IntentCategory | "UNKNOWN" = "UNKNOWN";
    let detectedLikelyGoal: LikelyGoal | "unsure" = "unsure";
    let intentDebug: string[] = [];

    if (lastUserMessage?.content) {
      const intentInfo = classifyVendorQuestion(lastUserMessage.content);
      detectedIntent = intentInfo.intent;
      detectedLikelyGoal = intentInfo.likelyGoal;
      intentDebug = intentInfo.reasons;
      
      // Optional: Log intent classification for debugging/analytics
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[vendor-analytics/chat] Intent classified: ${detectedIntent} (goal: ${detectedLikelyGoal})`,
          intentInfo.matchedKeywords.length > 0
            ? `(keywords: ${intentInfo.matchedKeywords.join(", ")})`
            : ""
        );
      }
    }

    // Build system prompt using the new Grok prompt function
    const systemPrompt = FOLIO_GROK_SYSTEM_PROMPT(
      detectedIntent,
      detectedLikelyGoal,
      dataSummary,
      capabilitiesSummary
    );

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...body.messages,
    ];

    if (!process.env.XAI_API_KEY) {
      return NextResponse.json(
        {
          answer:
            "X.AI API key is not configured. Please set XAI_API_KEY in your environment variables.",
          visualization: {
            type: "stat",
            title: "Status",
            primaryStatLabel: "Response",
            primaryStatValue: "Error",
          },
          followUpQuestions: [],
          actions: [],
        },
        { status: 500 }
      );
    }

    // Call Grok-4 API
    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "grok-2-1212", // Try grok-2-1212, or "grok-beta" if that doesn't work
          messages,
          temperature: 0.3,
          response_format: { type: "json_object" },
          max_tokens: 1200,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[vendor-analytics/chat] Grok API error:", response.status, errorText);
        throw new Error(`Grok API error: ${response.status} - ${errorText}`);
      }

      const completion = await response.json();
      const content = completion.choices?.[0]?.message?.content ?? "{}";
      
      if (!content || content === "{}") {
        console.error("[vendor-analytics/chat] Empty response from Grok:", completion);
        throw new Error("Empty response from Grok API");
      }
      let parsed: VendorAnalyticsChatResponse;

      try {
        parsed = JSON.parse(content) as VendorAnalyticsChatResponse;
      } catch (parseError) {
        console.error("[vendor-analytics/chat] JSON parse error:", parseError, "Content:", content);
        parsed = {
          answer:
            "I had trouble formatting a structured response. Please try asking the question again with slightly different wording.",
          visualization: {
            type: "stat",
            title: "Insight unavailable",
            primaryStatLabel: "Status",
            primaryStatValue: "N/A",
          },
          followUpQuestions: [],
          actions: [],
        };
      }

      if (!parsed.visualization) {
        parsed.visualization = {
          type: "stat",
          title: "Key metric",
          primaryStatLabel: "Value",
          primaryStatValue: "N/A",
        };
      }

      if (!parsed.followUpQuestions) {
        parsed.followUpQuestions = [];
      }

      if (!parsed.actions) {
        parsed.actions = [];
      }

      return NextResponse.json(parsed);
    } catch (apiError) {
      console.error("[vendor-analytics/chat] Grok API call error:", apiError);
      throw apiError;
    }
  } catch (error) {
    console.error("[vendor-analytics/chat] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        answer:
          `I encountered an error processing your question: ${errorMessage}. Please check the server logs for details.`,
        visualization: {
          type: "stat",
          title: "Status",
          primaryStatLabel: "Response",
          primaryStatValue: "Error",
        },
        followUpQuestions: [],
        actions: [],
      },
      { status: 500 }
    );
  }
}

