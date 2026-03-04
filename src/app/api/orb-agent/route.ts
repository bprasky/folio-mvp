export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_ENABLED = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_ENABLED !== "false";

interface OrbAgentRequest {
  question: string;
  nodeId?: string;
}

interface OrbAgentResponse {
  text: string;
  nodes?: string[];
  edges?: string[]; // EdgeId[]
  action?: {
    action: "highlightNode" | "openSlide" | "setTime" | "pause" | "resume";
    target?: string;
    value?: number;
  } | null;
}

const SYSTEM_PROMPT = `You are the "Folio Founder Agent," an AI trained on the Folio product, flywheel, data model, and business strategy.

The user is an investor or stakeholder exploring an interactive "Folio Orb" that visualizes the system.

Your goals:

- Explain how each node (Designers, Projects, Tags, Editorials, Vendors, Products, Boosts, Events, Discovery, Atelier, Earnings) fits into the system.
- Clearly communicate inputs, outputs, and how value is created for designers, vendors, and Folio.
- Emphasize that Folio is a system, not just a feature set.
- When helpful, return a JSON "action" object to control the orb in the UI.

You also have access to a set of edges that describe relationships between nodes (e.g. "tags-editorials", "editorials-vendors"), each with labels, descriptions, and example scenarios. Use this to explain cause and effect and to propose hypotheticals. Refer to nodes and edges by their ids when you return the nodes and edges fields.

Respond in JSON with:

{
  "text": "your explanation here",
  "nodes": ["editorials", "vendors"],
  "edges": ["tags-editorials", "editorials-vendors"],
  "action": {
    "action": "highlightNode",
    "target": "editorials"
  }
}

If no action is needed, set "action": null.
nodes should be an array of relevant node ids (NodeId strings).
edges should be an array of relevant edge ids (EdgeId strings like "tags-editorials").

Keep answers concise, structured, and focused on system-level cause and effect.`;

// Mock LLM response for when OpenAI is not configured
async function mockLLMResponse(question: string, nodeId?: string): Promise<OrbAgentResponse> {
  // Simple keyword-based responses
  const lowerQuestion = question.toLowerCase();
  
  let text = "Great question about the Folio system. ";
  let nodes: string[] = [];
  let action: OrbAgentResponse["action"] = null;

  if (lowerQuestion.includes("editorial") || lowerQuestion.includes("editorials")) {
    text += "Editorials sit between tags, discovery, and vendors. They turn designer projects into narrative, influence, and demand.";
    nodes = ["editorials", "tags", "discovery", "vendors"];
    action = { action: "highlightNode", target: "editorials" };
  } else if (lowerQuestion.includes("atelier")) {
    text += "Folio Atelier is the AI engine that unlocks once the system is alive. It transforms the platform from a tool into a creative and commercial co-pilot.";
    nodes = ["atelier", "projects", "tags", "editorials"];
    action = { action: "highlightNode", target: "atelier" };
  } else if (lowerQuestion.includes("earn") || lowerQuestion.includes("revenue") || lowerQuestion.includes("monet")) {
    text += "Folio earns through vendor boosts, affiliate revenue, sponsorships, and future marketplace transactions. The earnings node shows that Folio is not just a portfolio tool, but an economic engine.";
    nodes = ["earnings", "boosts", "vendors", "products"];
    action = { action: "highlightNode", target: "earnings" };
  } else if (lowerQuestion.includes("designer")) {
    text += "Designers are the gravitational center of Folio. Their projects, taste, and decisions generate nearly all of the system's meaningful data.";
    nodes = ["designers", "projects", "tags"];
    action = { action: "highlightNode", target: "designers" };
  } else if (lowerQuestion.includes("vendor")) {
    text += "Vendors bring products, marketing budgets, and showhouse presence. They benefit from rich analytics and placements inside real designer work.";
    nodes = ["vendors", "products", "boosts", "earnings"];
    action = { action: "highlightNode", target: "vendors" };
  } else if (lowerQuestion.includes("flywheel") || lowerQuestion.includes("how does it work")) {
    text += "The Folio flywheel starts with designers creating projects and tagging products. This feeds editorials and discovery, which attracts vendors. Vendors boost content and sponsor events, creating earnings that flow back to designers. This creates a self-reinforcing loop.";
    nodes = ["designers", "projects", "editorials", "vendors", "earnings"];
    action = null;
  } else {
    text += "Each node in the Folio system connects to others, creating value for designers, vendors, and the platform itself. The system gets stronger as more data flows through it.";
    nodes = nodeId ? [nodeId] : [];
    action = nodeId ? { action: "highlightNode", target: nodeId } : null;
  }

  return { text, nodes, edges: [], action };
}

// Real LLM call using Anthropic
async function callLLM(question: string, nodeId?: string): Promise<OrbAgentResponse> {
  if (!ANTHROPIC_ENABLED) {
    return mockLLMResponse(question, nodeId);
  }

  try {
    const client = new Anthropic();

    const userMessage = nodeId
      ? `Context: User is viewing the "${nodeId}" node. Question: ${question}`
      : question;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const rawContent = message.content[0]?.type === "text" ? message.content[0].text : null;
    if (!rawContent) {
      throw new Error("No response from Anthropic");
    }

    const content = rawContent.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(content) as OrbAgentResponse;
    return parsed;
  } catch (error) {
    console.error("[orb-agent] Anthropic error:", error);
    // Fallback to mock
    return mockLLMResponse(question, nodeId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: OrbAgentRequest = await request.json();
    const { question, nodeId } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Invalid request. 'question' is required." },
        { status: 400 }
      );
    }

    // Deduplication: Check for existing question (case-insensitive comparison)
    const trimmedQuestion = question.trim();
    const normalizedQuestion = trimmedQuestion.toLowerCase();
    
    // Fetch recent questions for this node (or all if no nodeId) to check for duplicates
    const recentQuestions = await prisma.orbQuestion.findMany({
      where: nodeId ? { nodeId } : {},
      orderBy: { createdAt: "desc" },
      take: 100, // Limit to recent 100 for performance
    });

    // Find exact match (case-insensitive)
    const exactMatch = recentQuestions.find(
      (q) => q.question.trim().toLowerCase() === normalizedQuestion
    );

    if (exactMatch) {
      // Return existing answer
      const response: OrbAgentResponse = {
        text: exactMatch.answer,
        nodes: exactMatch.nodeId ? [exactMatch.nodeId] : [],
        action: exactMatch.nodeId
          ? { action: "highlightNode", target: exactMatch.nodeId }
          : null,
      };
      return NextResponse.json(response);
    }

    // Call LLM (real or mock)
    const response = await callLLM(question, nodeId);

    // Determine nodeId for logging
    const logNodeId = nodeId || (response.nodes && response.nodes.length > 0 ? response.nodes[0] : null);

    // Log to database (store original question)
    await prisma.orbQuestion.create({
      data: {
        question: trimmedQuestion, // Store original question
        answer: response.text,
        nodeId: logNodeId || null,
        investorToken: null, // Will be wired later via investor portal
        edgeFrom: null,
        edgeTo: null,
        tags: response.nodes?.join(",") || null,
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[orb-agent] Error:", error);
    return NextResponse.json(
      { error: "Failed to process question" },
      { status: 500 }
    );
  }
}

