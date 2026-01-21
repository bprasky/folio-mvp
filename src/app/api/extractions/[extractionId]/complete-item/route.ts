/**
 * Complete Item API Route
 * POST /api/extractions/[extractionId]/complete-item
 *
 * Uses AI to complete missing fields in an extracted item
 */

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  ExtractionResult,
  ExtractedItem,
  completeSpecificationWithAI,
  updateItemInResult,
  findItemById
} from '@/lib/pdf'

interface CompleteItemRequest {
  itemId: string
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
    const body: CompleteItemRequest = await request.json()
    const { itemId } = body

    if (!itemId) {
      return NextResponse.json(
        { error: 'itemId is required' },
        { status: 400 }
      )
    }

    // Fetch the extraction
    const extraction = await prisma.pdfExtraction.findFirst({
      where: {
        id: extractionId,
        createdBy: userId
      }
    })

    if (!extraction) {
      return NextResponse.json(
        { error: 'Extraction not found' },
        { status: 404 }
      )
    }

    // Parse the result
    const result = extraction.result as unknown as ExtractionResult
    if (!result || !result.items) {
      return NextResponse.json(
        { error: 'Invalid extraction result' },
        { status: 400 }
      )
    }

    // Find the item
    const item = findItemById(result.items, itemId)
    if (!item) {
      return NextResponse.json(
        { error: 'Item not found in extraction' },
        { status: 404 }
      )
    }

    // Check if item needs completion
    if (item.missingFields.length === 0) {
      return NextResponse.json({
        item,
        message: 'Item already complete'
      })
    }

    // Complete the item with AI
    console.log(`Completing item ${itemId} with AI...`)
    const completedItem = await completeSpecificationWithAI(item)

    // Update the extraction result
    const updatedItems = updateItemInResult(result.items, completedItem)
    const updatedResult: ExtractionResult = {
      ...result,
      items: updatedItems
    }

    // Save back to database
    await prisma.pdfExtraction.update({
      where: { id: extractionId },
      data: {
        result: updatedResult as unknown as Record<string, unknown>,
        updatedAt: new Date()
      }
    })

    console.log(`Item ${itemId} completed. Missing fields reduced from ${item.missingFields.length} to ${completedItem.missingFields.length}`)

    return NextResponse.json({
      item: completedItem,
      previousMissingFields: item.missingFields,
      message: `Completed ${item.missingFields.length - completedItem.missingFields.length} fields`
    })

  } catch (error) {
    console.error('Failed to complete item:', error)
    return NextResponse.json(
      { error: 'Failed to complete item with AI' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/extractions/[extractionId]/complete-item
 *
 * Manually update fields on an extracted item
 */
export async function PATCH(
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
    const body = await request.json()
    const { itemId, updates } = body as {
      itemId: string
      updates: Partial<ExtractedItem>
    }

    if (!itemId || !updates) {
      return NextResponse.json(
        { error: 'itemId and updates are required' },
        { status: 400 }
      )
    }

    // Fetch the extraction
    const extraction = await prisma.pdfExtraction.findFirst({
      where: {
        id: extractionId,
        createdBy: userId
      }
    })

    if (!extraction) {
      return NextResponse.json(
        { error: 'Extraction not found' },
        { status: 404 }
      )
    }

    // Parse the result
    const result = extraction.result as unknown as ExtractionResult

    // Find and update the item
    const item = findItemById(result.items, itemId)
    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    // Merge updates (only allow certain fields to be updated)
    const allowedFields: (keyof ExtractedItem)[] = [
      'productName', 'brand', 'vendor', 'sku', 'price',
      'dimensions', 'material', 'finish', 'description', 'productUrl'
    ]

    const updatedItem: ExtractedItem = { ...item }
    for (const field of allowedFields) {
      if (field in updates && updates[field] !== undefined) {
        (updatedItem as Record<string, unknown>)[field] = updates[field]
      }
    }

    // Recalculate computed fields
    const { recalculateItemFields } = await import('@/lib/pdf')
    const finalItem = recalculateItemFields(updatedItem)

    // Update the extraction result
    const updatedItems = updateItemInResult(result.items, finalItem)
    const updatedResult: ExtractionResult = {
      ...result,
      items: updatedItems
    }

    // Save back to database
    await prisma.pdfExtraction.update({
      where: { id: extractionId },
      data: {
        result: updatedResult as unknown as Record<string, unknown>,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      item: finalItem,
      message: 'Item updated successfully'
    })

  } catch (error) {
    console.error('Failed to update item:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}
