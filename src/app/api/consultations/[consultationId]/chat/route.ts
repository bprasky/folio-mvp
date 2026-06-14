export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import Anthropic from "@anthropic-ai/sdk";
import { buildConsultationPrompt } from "@/lib/atelier/buildConsultationPrompt";
import { ConsultationStatus } from "@prisma/client";
import { MODELS } from '@/lib/ai/models';

type Params = { params: { consultationId: string } };

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------

const CONSULTATION_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_products_for_slot",
    description:
      "Get available products for a specific room and slot category. Use when the buyer asks about options for a particular area.",
    input_schema: {
      type: "object" as const,
      properties: {
        roomName: {
          type: "string",
          description: "Name of the room (e.g., Kitchen, Master Bath)",
        },
        slotCategory: {
          type: "string",
          description:
            "Category: FLOORING, COUNTERTOP, CABINET, FIXTURE, APPLIANCE, etc.",
        },
      },
      required: ["roomName", "slotCategory"],
    },
  },
  {
    name: "make_selection",
    description:
      "Select a product for a specific slot. Use when the buyer confirms a choice.",
    input_schema: {
      type: "object" as const,
      properties: {
        roomName: { type: "string" },
        slotCategory: { type: "string" },
        productId: { type: "string" },
        reasoning: {
          type: "string",
          description: "Brief note on why this was selected",
        },
      },
      required: ["roomName", "slotCategory", "productId"],
    },
  },
  {
    name: "get_current_summary",
    description: "Get current selections and total upgrade cost",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "note_buyer_preference",
    description:
      "Record something the buyer mentioned about their preferences, lifestyle, or budget. This helps inform future recommendations.",
    input_schema: {
      type: "object" as const,
      properties: {
        preferenceType: {
          type: "string",
          enum: ["preference", "budget", "lifestyle"],
          description: "Type of information being noted",
        },
        note: {
          type: "string",
          description: "What the buyer mentioned",
        },
      },
      required: ["preferenceType", "note"],
    },
  },
];

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

/**
 * POST /api/consultations/[consultationId]/chat
 *
 * Handle chat messages in a consultation session.
 * Uses designer-informed prompts and can make selections via tools.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { consultationId } = params;
    const searchParams = req.nextUrl.searchParams;
    const buyerToken = searchParams.get("buyerToken");
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array required" },
        { status: 400 }
      );
    }

    // Load consultation with all context
    const consultation = await loadConsultationContext(consultationId);
    if (!consultation) {
      return NextResponse.json(
        { error: "Consultation not found" },
        { status: 404 }
      );
    }

    // Check access
    const hasAccess = await checkConsultationAccess(
      consultation,
      buyerToken
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Consultation must be in progress
    if (consultation.status !== ConsultationStatus.IN_PROGRESS) {
      return NextResponse.json(
        { error: `Consultation is ${consultation.status}, not active` },
        { status: 400 }
      );
    }

    // Load designer with reasoning profile
    const designer = await loadDesignerWithReasoning(consultation.designerId);
    if (!designer) {
      return NextResponse.json(
        { error: "Designer not found" },
        { status: 404 }
      );
    }

    // Load available products
    const availableProducts = await loadAvailableProducts(
      consultation.developmentId,
      consultation.finishPackage.tier,
      consultation.unitTypeId
    );

    // Load current selections
    const currentSelections = await loadCurrentSelections(consultationId);

    // Build the system prompt
    const systemPrompt = buildConsultationPrompt({
      designer: {
        id: designer.id,
        name: designer.name || "Designer",
        bio: designer.bio,
        studio: designer.studio,
      },
      reasoningProfile: designer.reasoningProfile,
      fingerprint: null, // Could add fingerprint data if available
      development: {
        name: consultation.development.name,
        location: consultation.development.address || "",
        description: consultation.development.description,
        developerName: consultation.development.developerOrg?.name || "",
      },
      consultation: {
        unitTypeName: consultation.unitType.name,
        unitDetails: {
          bedrooms: consultation.unitType.bedroomCount,
          bathrooms: consultation.unitType.bathroomCount,
          sqft: consultation.unitType.sqft || 0,
        },
        finishPackageName: consultation.finishPackage.name,
        finishPackageTier: consultation.finishPackage.tier as
          | "STANDARD"
          | "PREMIUM"
          | "LUXURY",
      },
      availableProducts,
      currentSelections,
      buyerContext: (consultation.notes as any)?.buyerContext || undefined,
    });

    // Call Claude
    const anthropic = new Anthropic();

    let response = await anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 1024,
      system: systemPrompt,
      tools: CONSULTATION_TOOLS,
      messages: messages,
    });

    // Handle tool use
    const toolResults: any[] = [];
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block) => block.type === "tool_use"
      );

      for (const toolUse of toolUseBlocks) {
        if (toolUse.type !== "tool_use") continue;

        const result = await handleToolCall(
          consultationId,
          toolUse.name,
          toolUse.input as Record<string, any>,
          consultation
        );

        toolResults.push({
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Continue conversation with tool results
      response = await anthropic.messages.create({
        model: MODELS.sonnet,
        max_tokens: 1024,
        system: systemPrompt,
        tools: CONSULTATION_TOOLS,
        messages: [
          ...messages,
          { role: "assistant" as const, content: response.content },
          { role: "user" as const, content: toolResults },
        ],
      });
    }

    // Extract text response
    const textContent = response.content.find((block) => block.type === "text");
    const responseText = textContent?.type === "text" ? textContent.text : "";

    // Get updated selections if any were made
    const updatedSelections = await loadCurrentSelections(consultationId);
    const totalUpgradeCents = updatedSelections.reduce(
      (sum, s) => sum + s.upgradeCost,
      0
    );

    return NextResponse.json({
      response: responseText,
      toolsUsed: toolResults.length > 0,
      currentSelections: updatedSelections,
      totalUpgradeCents,
    });
  } catch (error: any) {
    console.error("Error in consultation chat:", error);
    return NextResponse.json(
      { error: error?.message || "Chat failed" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Data Loading Functions
// ---------------------------------------------------------------------------

async function loadConsultationContext(consultationId: string) {
  return prisma.consultation.findUnique({
    where: { id: consultationId },
    include: {
      development: {
        include: {
          developerOrg: true,
        },
      },
      unitType: {
        include: {
          rooms: {
            include: {
              finishSlots: true,
            },
          },
        },
      },
      finishPackage: true,
      buyer: true,
    },
  });
}

async function loadDesignerWithReasoning(designerId: string) {
  return prisma.user.findUnique({
    where: { id: designerId },
    include: {
      reasoningProfile: true,
    },
  });
}

async function loadAvailableProducts(
  developmentId: string,
  packageTier: string,
  unitTypeId: string
) {
  // Get unit type with rooms and slots
  const unitType = await prisma.unitType.findUnique({
    where: { id: unitTypeId },
    include: {
      rooms: {
        include: {
          finishSlots: true,
        },
      },
    },
  });

  if (!unitType) return [];

  // Get all development products available in this tier
  const developmentProducts = await prisma.developmentProduct.findMany({
    where: {
      developmentId,
      availableInPackages: { has: packageTier },
    },
    include: {
      product: {
        include: {
          vendor: true,
        },
      },
    },
  });

  // Organize by room and slot
  const result: {
    slotCategory: string;
    roomName: string;
    products: {
      id: string;
      name: string;
      vendorName: string;
      tier: string;
      upgradeCost: number;
      description: string | null;
      material: string | null;
    }[];
  }[] = [];

  for (const room of unitType.rooms) {
    for (const slot of room.finishSlots) {
      // Filter products that match this slot category
      const matchingProducts = developmentProducts.filter((dp) => {
        const category = dp.product.category || "";
        return category.toUpperCase().includes(slot.slotKey.toUpperCase());
      });

      if (matchingProducts.length > 0) {
        result.push({
          slotCategory: slot.slotKey,
          roomName: room.roomType,
          products: matchingProducts.map((dp) => ({
            id: dp.id,
            name: dp.product.name,
            vendorName: dp.product.vendor?.name || "Unknown",
            tier: dp.availableInPackages[0] || "STANDARD",
            upgradeCost: dp.upgradePriceCents || 0,
            description: dp.product.description,
            material: dp.product.material,
          })),
        });
      }
    }
  }

  return result;
}

async function loadCurrentSelections(consultationId: string) {
  const selections = await prisma.consultationSelection.findMany({
    where: { consultationId },
    include: {
      developmentProduct: {
        include: {
          product: true,
        },
      },
    },
  });

  return selections.map((s) => ({
    slotCategory: s.slotKey,
    roomName: s.roomType,
    productName: s.developmentProduct.product.name,
    upgradeCost: s.upgradePriceCents || 0,
  }));
}

// ---------------------------------------------------------------------------
// Tool Handlers
// ---------------------------------------------------------------------------

async function handleToolCall(
  consultationId: string,
  toolName: string,
  input: Record<string, any>,
  consultation: any
): Promise<any> {
  switch (toolName) {
    case "get_products_for_slot": {
      const products = await loadAvailableProducts(
        consultation.developmentId,
        consultation.finishPackage.tier,
        consultation.unitTypeId
      );

      const slot = products.find(
        (p) =>
          p.roomName.toLowerCase() === input.roomName.toLowerCase() &&
          p.slotCategory.toLowerCase() === input.slotCategory.toLowerCase()
      );

      return slot || { products: [], message: "No products found for this slot" };
    }

    case "make_selection": {
      // Find the development product
      const devProduct = await prisma.developmentProduct.findUnique({
        where: { id: input.productId },
        include: { product: true },
      });

      if (!devProduct) {
        return { success: false, error: "Product not found" };
      }

      // Upsert selection
      const existing = await prisma.consultationSelection.findFirst({
        where: {
          consultationId,
          roomType: input.roomName,
          slotKey: input.slotCategory,
        },
      });

      if (existing) {
        await prisma.consultationSelection.update({
          where: { id: existing.id },
          data: {
            developmentProductId: devProduct.id,
            isUpgrade: devProduct.isUpgrade || false,
            upgradePriceCents: devProduct.upgradePriceCents || 0,
          },
        });
      } else {
        await prisma.consultationSelection.create({
          data: {
            consultationId,
            developmentProductId: devProduct.id,
            roomType: input.roomName,
            slotKey: input.slotCategory,
            isUpgrade: devProduct.isUpgrade || false,
            upgradePriceCents: devProduct.upgradePriceCents || 0,
          },
        });
      }

      // Update total
      const allSelections = await prisma.consultationSelection.findMany({
        where: { consultationId },
      });
      const total = allSelections.reduce(
        (sum, s) => sum + (s.upgradePriceCents || 0),
        0
      );

      await prisma.consultation.update({
        where: { id: consultationId },
        data: { totalUpgradeCents: total },
      });

      return {
        success: true,
        selection: {
          room: input.roomName,
          slot: input.slotCategory,
          product: devProduct.product.name,
          upgradeCost: devProduct.upgradePriceCents || 0,
        },
        newTotal: total,
      };
    }

    case "get_current_summary": {
      const selections = await loadCurrentSelections(consultationId);
      const total = selections.reduce((sum, s) => sum + s.upgradeCost, 0);

      return {
        selections,
        totalUpgradeCents: total,
        formattedTotal: `$${total.toLocaleString()}`,
      };
    }

    case "note_buyer_preference": {
      // Store buyer preferences in consultation notes
      const current = (consultation.notes as any) || {};
      const buyerContext = current.buyerContext || {
        statedPreferences: [],
        budgetSignals: [],
        lifestyleNotes: [],
      };

      if (input.preferenceType === "preference") {
        buyerContext.statedPreferences.push(input.note);
      } else if (input.preferenceType === "budget") {
        buyerContext.budgetSignals.push(input.note);
      } else if (input.preferenceType === "lifestyle") {
        buyerContext.lifestyleNotes.push(input.note);
      }

      await prisma.consultation.update({
        where: { id: consultationId },
        data: {
          notes: { ...current, buyerContext },
        },
      });

      return { success: true, noted: input.note };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ---------------------------------------------------------------------------
// Access Control
// ---------------------------------------------------------------------------

async function checkConsultationAccess(
  consultation: any,
  buyerToken: string | null
): Promise<boolean> {
  // Buyer token access
  if (buyerToken) {
    const buyer = await prisma.consultationBuyer.findFirst({
      where: {
        sessionToken: buyerToken,
        sessionExpiresAt: { gt: new Date() },
      },
    });
    return buyer?.id === consultation.buyerId;
  }

  // Authenticated user access
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return false;
  }

  const user = session.user as { id: string; role: string };

  // Admin access
  if (user.role === "ADMIN") {
    return true;
  }

  // Designer access
  if (user.id === consultation.designerId) {
    return true;
  }

  return false;
}
