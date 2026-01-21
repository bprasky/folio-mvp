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

interface ConfirmRequest {
  selectedItems: string[]  // Item IDs to import
  roomId: string
}

interface ConfirmResult {
  products: string[]      // Created product IDs
  selections: string[]    // Created selection IDs
  skeletons: string[]     // Created skeleton item IDs
  errors: string[]        // Any errors during processing
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
    const { selectedItems, roomId } = body

    if (!selectedItems || !Array.isArray(selectedItems) || selectedItems.length === 0) {
      return NextResponse.json(
        { error: 'selectedItems array is required' },
        { status: 400 }
      )
    }

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId is required' },
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

    // Verify room belongs to project
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        projectId: extraction.projectId
      }
    })

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found in this project' },
        { status: 404 }
      )
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
      errors: []
    }

    // Process each selected item
    for (const item of toImport) {
      try {
        if (item.type === 'specification') {
          // Create selection directly for specifications
          await createSelection(item, roomId, extraction.projectId, extraction.id, created)
        } else {
          // Create skeleton item for inspiration/incomplete items
          await createSkeletonItem(item, roomId, extraction.projectId, extraction.id, created)
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

    return NextResponse.json({
      created,
      message: `Imported ${created.selections.length} specifications and ${created.skeletons.length} placeholders`
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

  // Create the selection
  const selection = await prisma.selection.create({
    data: {
      projectId,
      roomId,
      vendorName: item.vendor || item.brand,
      productName: item.productName,
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
        dimensions: item.dimensions
      }
    }
  })

  created.selections.push(selection.id)
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
