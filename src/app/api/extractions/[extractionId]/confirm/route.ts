/**
 * Confirm Extraction API Route
 * POST /api/extractions/[extractionId]/confirm
 *
 * Confirms selected items and creates products/skeleton placeholders
 */

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ExtractionResult, ExtractedItem, getAllItems } from '@/lib/pdf'
import { uploadDataUrlToSupabase } from '@/lib/uploadToSupabase'
import { ensureProductForSelection } from '@/lib/tagging/ensureProductForSelection'

interface ConfirmRequest {
  selectedItems: string[]  // Item IDs to import
  roomId?: string          // Optional fallback room for items with no room of their own
  roomOverrides?: Record<string, string>  // itemId -> room name, chosen in the review modal
  // itemId -> what to do when the product already exists in its target room.
  // 'skip' = leave the existing one, 'merge' = fill the existing one's blanks
  // from this import, 'keep' = create a second copy. Default when a product is a
  // duplicate and no action is given: 'skip'.
  duplicateActions?: Record<string, 'skip' | 'merge' | 'keep'>
}

/** Normalize a room name for matching ("DINING ROOM" == "Dining Room"). */
function normalizeRoomName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Title-case a raw room name for display when creating ("DINING ROOM" -> "Dining Room"). */
function titleCaseRoomName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

interface ConfirmResult {
  products: string[]      // Created product IDs
  selections: string[]    // Created selection IDs
  skeletons: string[]     // Created skeleton item IDs
  duplicates: string[]    // Products skipped because they already exist in the room
  merged: string[]        // Existing products enriched with this import's data
  errors: string[]        // Any errors during processing
}

/** Dedup key for a product within a room (case-insensitive name). */
function selectionDedupKey(roomId: string, productName: string | null): string {
  return `${roomId}::${(productName || '').trim().toLowerCase()}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: { extractionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const extractionId = params.extractionId

    // Parse request body
    const body: ConfirmRequest = await request.json()
    const { selectedItems, roomId, roomOverrides, duplicateActions } = body

    if (!selectedItems || !Array.isArray(selectedItems) || selectedItems.length === 0) {
      return NextResponse.json(
        { error: 'selectedItems array is required' },
        { status: 400 }
      )
    }

    // Fetch the extraction with project info
    const extraction = await prisma.pdfExtraction.findFirst({
      where: {
        id: extractionId,
        createdBy: userId
      },
      include: {
        project: {
          select: {
            id: true,
            designerId: true,
            ownerId: true
          }
        }
      }
    })

    if (!extraction) {
      return NextResponse.json(
        { error: 'Extraction not found' },
        { status: 404 }
      )
    }

    // Load the project's rooms so each item can be sorted into its own room
    // (matched by name, created on demand). Verify the optional fallback room.
    const existingRooms = await prisma.room.findMany({
      where: { projectId: extraction.projectId },
      select: { id: true, name: true },
    })
    const roomIdByName = new Map<string, string>()
    for (const r of existingRooms) roomIdByName.set(normalizeRoomName(r.name), r.id)

    if (roomId && !existingRooms.some((r) => r.id === roomId)) {
      return NextResponse.json(
        { error: 'Room not found in this project' },
        { status: 404 }
      )
    }

    // Find-or-create the room for a given name, caching results so we only
    // create each room once across the whole import.
    const resolveRoomId = async (roomName: string | null): Promise<string> => {
      const raw = roomName?.trim()
      const norm = normalizeRoomName(raw || 'General')
      const cached = roomIdByName.get(norm)
      if (cached) return cached
      const created = await prisma.room.create({
        data: { name: raw ? titleCaseRoomName(raw) : 'General', projectId: extraction.projectId },
      })
      roomIdByName.set(norm, created.id)
      return created.id
    }

    // Parse the result
    const result = extraction.result as unknown as ExtractionResult
    const allItems = getAllItems(result.items)

    // Filter to selected items
    const toImport = allItems.filter(i => selectedItems.includes(i.id))

    if (toImport.length === 0) {
      return NextResponse.json(
        { error: 'No valid items selected for import' },
        { status: 400 }
      )
    }

    const created: ConfirmResult = {
      products: [],
      selections: [],
      skeletons: [],
      duplicates: [],
      merged: [],
      errors: []
    }

    // Pre-load existing selections (with the fields we can merge) so a product
    // already present in its target room can be skipped, merged, or kept per the
    // caller's duplicateActions. Keyed by room + normalized product name.
    const existingSelections = await prisma.selection.findMany({
      where: { projectId: extraction.projectId },
      select: {
        id: true,
        roomId: true,
        productName: true,
        vendorName: true,
        vendorProductId: true,
        colorFinish: true,
        notes: true,
        unitPrice: true,
        productUrl: true,
        uiMeta: true,
      },
    })
    const existingByKey = new Map<string, (typeof existingSelections)[number]>()
    for (const s of existingSelections) {
      existingByKey.set(selectionDedupKey(s.roomId ?? '', s.productName), s)
    }
    const seenSelectionKeys = new Set(existingByKey.keys())

    // Rooms we actually wrote into — returned so the client can scope the
    // vision auto-tagger to just the rooms this import touched.
    const usedRoomIds = new Set<string>()

    // Process each selected item, sorting it into its own room. Items that carry
    // a room from the PDF go there (matched/created by name); anything without one
    // falls back to the caller's roomId, else a "General" room.
    for (const item of toImport) {
      try {
        // A room chosen in the review modal wins over the segmented room.
        const roomName = roomOverrides?.[item.id] ?? item.room
        const targetRoomId = roomName
          ? await resolveRoomId(roomName)
          : roomId || (await resolveRoomId(null))
        usedRoomIds.add(targetRoomId)

        if (item.type === 'specification') {
          const key = selectionDedupKey(targetRoomId, item.productName)
          const existing = existingByKey.get(key)
          const label = item.productName || item.brand || 'Unknown'

          if (existing) {
            // Product already in this room — do what the reviewer chose.
            const action = duplicateActions?.[item.id] ?? 'skip'
            if (action === 'skip') {
              created.duplicates.push(label)
              continue
            }
            if (action === 'merge') {
              await mergeSelection(existing, item, created)
              continue
            }
            // 'keep' falls through to create a second copy.
          }

          seenSelectionKeys.add(key)
          // Create selection directly for specifications
          await createSelection(item, targetRoomId, extraction.projectId, extraction.id, created)
        } else {
          // Create skeleton item for inspiration/incomplete items
          await createSkeletonItem(item, targetRoomId, extraction.projectId, extraction.id, created)
        }
      } catch (err) {
        console.error(`Failed to process item ${item.id}:`, err)
        created.errors.push(`Failed to import item: ${item.productName || item.brand || 'Unknown'}`)
      }
    }

    // Mark extraction as completed
    await prisma.pdfExtraction.update({
      where: { id: extractionId },
      data: { status: 'completed' }
    })

    console.log(`Extraction ${extractionId} confirmed: ${created.selections.length} selections, ${created.skeletons.length} skeletons`)

    const parts = [`Imported ${created.selections.length} specifications`]
    if (created.merged.length) parts.push(`merged ${created.merged.length}`)
    if (created.duplicates.length) parts.push(`skipped ${created.duplicates.length} already imported`)
    if (created.skeletons.length) parts.push(`${created.skeletons.length} placeholders`)
    return NextResponse.json({
      created,
      roomIds: Array.from(usedRoomIds),
      message: parts.join(', '),
    })

  } catch (error) {
    console.error('Failed to confirm extraction:', error)
    return NextResponse.json(
      { error: 'Failed to confirm extraction' },
      { status: 500 }
    )
  }
}

/**
 * Creates a Selection for a specification item
 */
async function createSelection(
  item: ExtractedItem,
  roomId: string,
  projectId: string,
  extractionId: string,
  created: ConfirmResult
): Promise<void> {
  // Upload image if available
  let imageUrl: string | null = null
  if (item.imageData) {
    try {
      const dataUrl = `data:image/png;base64,${item.imageData}`
      imageUrl = await uploadDataUrlToSupabase(
        dataUrl,
        `extractions/${extractionId}/${item.id}.png`
      )
    } catch (err) {
      console.warn(`Failed to upload image for item ${item.id}:`, err)
    }
  }

  // Ensure a Product record exists for the attribution chain
  const linkedProductId = await ensureProductForSelection({
    productName: item.productName,
    vendorName: item.vendor || item.brand,
    photo: imageUrl,
    unitPrice: item.price ? item.price / 100 : null,
    productUrl: item.productUrl,
  })

  // Create the selection
  const selection = await prisma.selection.create({
    data: {
      projectId,
      roomId,
      vendorName: item.vendor || item.brand,
      productName: item.productName,
      vendorProductId: item.sku,
      colorFinish: item.finish || item.material,
      notes: item.description || item.sourceText.join('\n'),
      photo: imageUrl,
      unitPrice: item.price ? item.price / 100 : null,
      productUrl: item.productUrl,
      source: 'pdf_extraction',
      tags: ['pdf-import'],
      uiMeta: {
        extractionId,
        extractedItemId: item.id,
        confidence: item.confidence,
        dimensions: item.dimensions,
        ...(linkedProductId ? { productId: linkedProductId } : {}),
      }
    }
  })

  created.selections.push(selection.id)
}

/**
 * Enriches an existing selection with this import's data, filling only its blank
 * fields (never overwriting values the existing record already has). The result
 * is the union of both — i.e. "keep the more complete information".
 */
async function mergeSelection(
  existing: {
    id: string
    vendorName: string | null
    vendorProductId: string | null
    colorFinish: string | null
    notes: string | null
    unitPrice: unknown
    productUrl: string | null
    uiMeta: unknown
  },
  item: ExtractedItem,
  created: ConfirmResult,
): Promise<void> {
  const label = item.productName || item.brand || 'Unknown'
  const data: Record<string, unknown> = {}
  const fillStr = (field: string, cur: string | null, incoming: string | null | undefined) => {
    if ((cur == null || cur === '') && incoming) data[field] = incoming
  }

  fillStr('vendorName', existing.vendorName, item.vendor || item.brand)
  fillStr('vendorProductId', existing.vendorProductId, item.sku)
  fillStr('colorFinish', existing.colorFinish, item.finish || item.material)
  fillStr('notes', existing.notes, item.description)
  fillStr('productUrl', existing.productUrl, item.productUrl)
  if (existing.unitPrice == null && item.price != null) data.unitPrice = item.price / 100

  // Dimensions live in uiMeta.
  const meta = (existing.uiMeta as Record<string, unknown> | null) || {}
  if (item.dimensions && meta.dimensions == null) {
    data.uiMeta = { ...meta, dimensions: item.dimensions }
  }

  if (Object.keys(data).length > 0) {
    await prisma.selection.update({ where: { id: existing.id }, data })
  }
  created.merged.push(label)
}

/**
 * Creates a SkeletonItem for an inspiration or incomplete item
 */
async function createSkeletonItem(
  item: ExtractedItem,
  roomId: string,
  projectId: string,
  extractionId: string,
  created: ConfirmResult
): Promise<void> {
  // Upload image if available
  let imageUrl: string | null = null
  if (item.imageData) {
    try {
      const dataUrl = `data:image/png;base64,${item.imageData}`
      imageUrl = await uploadDataUrlToSupabase(
        dataUrl,
        `extractions/${extractionId}/skeleton-${item.id}.png`
      )
    } catch (err) {
      console.warn(`Failed to upload image for skeleton ${item.id}:`, err)
    }
  }

  const skeleton = await prisma.skeletonItem.create({
    data: {
      projectId,
      roomId,
      searchQuery: item.searchQuery,
      description: item.description || item.productName,
      imageData: item.imageData?.substring(0, 1000), // Store truncated for reference
      imageUrl,
      extractedBrand: item.brand,
      extractedPrice: item.price,
      extractedMaterial: item.material,
      extractedDimensions: item.dimensions as Record<string, unknown> | null,
      sourceExtractionId: extractionId,
      sourcePage: item.page,
      status: 'UNCONFIRMED'
    }
  })

  created.skeletons.push(skeleton.id)
}

/**
 * GET /api/extractions/[extractionId]/confirm
 *
 * Get extraction details for confirmation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { extractionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const extractionId = params.extractionId

    const extraction = await prisma.pdfExtraction.findFirst({
      where: {
        id: extractionId,
        createdBy: userId
      },
      include: {
        project: {
          include: {
            rooms: {
              select: {
                id: true,
                name: true,
                type: true
              }
            }
          }
        }
      }
    })

    if (!extraction) {
      return NextResponse.json(
        { error: 'Extraction not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      extraction: {
        id: extraction.id,
        fileName: extraction.fileName,
        status: extraction.status,
        createdAt: extraction.createdAt,
        result: extraction.result
      },
      project: {
        id: extraction.project.id,
        rooms: extraction.project.rooms
      }
    })

  } catch (error) {
    console.error('Failed to fetch extraction:', error)
    return NextResponse.json(
      { error: 'Failed to fetch extraction' },
      { status: 500 }
    )
  }
}
