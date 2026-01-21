/**
 * PDF Extraction API Route
 * POST /api/projects/[id]/extract-pdf
 *
 * Extracts product specifications from uploaded PDF files
 */

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assertProjectView } from '@/lib/authz/access'
import prisma from '@/lib/prisma'
import { extractSpecificationsFromPDF, ExtractionResult } from '@/lib/pdf'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Verify project access
    await assertProjectView(userId, projectId)

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { designerId: userId },
          { ownerId: userId }
        ]
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      )
    }

    // Validate file size (max 50MB)
    const MAX_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract specifications from PDF
    console.log(`Starting PDF extraction for project ${projectId}, file: ${file.name}`)
    const result = await extractSpecificationsFromPDF(buffer, {
      generateImageSearchQueries: true,
      useVisualAnalysis: true,
      maxItemsPerPage: 20
    })

    // Store extraction result for later confirmation
    const extraction = await prisma.pdfExtraction.create({
      data: {
        projectId,
        fileName: file.name,
        result: result as unknown as Record<string, unknown>,
        status: 'pending_review',
        createdBy: userId
      }
    })

    console.log(`PDF extraction complete. ID: ${extraction.id}, Items: ${
      result.items.high.length + result.items.medium.length + result.items.low.length
    }`)

    return NextResponse.json({
      extractionId: extraction.id,
      ...result
    })

  } catch (error) {
    console.error('PDF extraction failed:', error)

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        return NextResponse.json(
          { error: 'Invalid PDF file. The file may be corrupted or encrypted.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'PDF extraction failed. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/projects/[id]/extract-pdf
 *
 * Get all PDF extractions for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Verify project access
    await assertProjectView(userId, projectId)

    const extractions = await prisma.pdfExtraction.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        status: true,
        createdAt: true,
        result: true
      }
    })

    // Add summary stats to each extraction
    const extractionsWithStats = extractions.map(ext => {
      const result = ext.result as unknown as ExtractionResult | null
      return {
        ...ext,
        stats: result ? result.stats : null
      }
    })

    return NextResponse.json({ extractions: extractionsWithStats })

  } catch (error) {
    console.error('Failed to fetch extractions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch extractions' },
      { status: 500 }
    )
  }
}
