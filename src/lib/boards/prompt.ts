// ---------- utils ----------
type Dim = { widthIn?: number; depthIn?: number; heightIn?: number };

function fmtDims(dim?: Dim) {
  if (!dim) return "";
  const w = dim.widthIn ? `${dim.widthIn}"` : null;
  const d = dim.depthIn ? `${dim.depthIn}"` : null;
  const h = dim.heightIn ? `${dim.heightIn}"` : null;
  const parts = [w, d, h].filter(Boolean);
  return parts.length ? ` (${parts.join(" × ")})` : "";
}

function canon(str?: string) {
  return (str ?? "").trim().toLowerCase();
}

function uniqWords(input: string) {
  const seen = new Set<string>();
  return input
    .split(/[,\s]+/)
    .map(w => w.trim())
    .filter(w => {
      if (!w) return false;
      const key = w.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" ");
}

// ---------- main builder ----------
export async function buildBasePrompt({
  projectId,
  roomId,
}: {
  projectId: string;
  roomId: string;
}): Promise<{
  base: string;
  context: Record<string, any>;
  selectionIds: string[];
}> {
  // Fetch room, selections, and any style tags your app stores
  const { prisma } = await import("@/lib/prisma");

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, name: true, type: true },
  });

  const selections = await prisma.selection.findMany({
    where: { projectId, roomId },
    orderBy: [{ slotKey: "asc" }, { createdAt: "asc" }], // deterministic
    select: {
      id: true,
      slotKey: true,               // e.g., "sofa", "accent chair", "coffee table"
      productName: true,
      vendorName: true,
      colorFinish: true,           // e.g., "bouclé fabric", "oak", "marble", "matte black"
      photo: true,                 // primary vendor image; keep as URL string
      tags: true,                  // array<string>
      uiMeta: true,                // UI metadata including dimensions
    },
  });

  // Normalize + compress into prompt lines
  const items = selections.map(s => {
    const role = canon(s.slotKey) || "product";
    const vendor = s.vendorName?.trim();
    const name = s.productName?.trim();
    const colorFinish = s.colorFinish?.trim();
    const dims = fmtDims((s.uiMeta as any)?.dimensions as Dim);
    const img = s.photo?.trim(); // used as text ref; see note below

    // One concise, highly-informative line per product
    const line =
      `- ${role}: ${vendor ? `${vendor} ` : ""}${name ?? ""}`.trim() +
      `${colorFinish ? `, ${colorFinish}` : ""}` +
      `${dims}`;

    return {
      id: s.id,
      role,
      line,
      imageUrl: img,
      styleTags: s.tags ?? [],
    };
  });

  // Aggregate style cues
  const roomStyle = [room?.type, room?.name].filter(Boolean).join(" ");
  const derivedTags = Array.from(
    new Set(items.flatMap(i => i.styleTags ?? []))
  ).slice(0, 8);

  // ---- Structured prompt (compact, deterministic) ----
  const header = `Create a single editorial interior render for the "${room?.name ?? "room"}".`;
  const style = `Style & mood: ${uniqWords([roomStyle, derivedTags.join(" ")].filter(Boolean).join(" "))}.`;
  const must = `Must include these exact products with faithful geometry, materials, finishes, colors, and relative scale:`;
  const list = items.map(i => i.line).join("\n");
  const refs =
    items
      .filter(i => i.imageUrl)
      .map(i => `Reference image for ${i.role}: ${i.imageUrl}`)
      .join("\n") || "";

  const guardrails =
    `Constraints:\n` +
    `- Preserve product proportions and materials; do not substitute lookalikes.\n` +
    `- Keep camera at human eye level; soft natural light; avoid harsh HDR.\n` +
    `- Keep palette cohesive and warm; no extra furniture unless minimal décor is needed.\n` +
    `- Avoid text or logos unless present in references.\n` +
    `- If an attribute is missing, choose the closest plausible option but keep the composition simple.`;

  const base =
    [
      header,
      style,
      must,
      list,
      refs && `References:\n${refs}`,
      guardrails,
      `Output: photorealistic, single image.`,
    ]
      .filter(Boolean)
      .join("\n\n");

  const context = {
    roomId,
    roomName: room?.name ?? null,
    roomType: room?.type ?? null,
    selections: items,
  };

  const selectionIds = items.map(i => i.id);

  return { base, context, selectionIds };
}

// Keep but improve modifiers
export function mergeModifiers(base: string, modifiers: string) {
  if (!modifiers) return base;
  const clean = uniqWords(modifiers);
  return `${base}\n\nAdditional art direction: ${clean}`;
}