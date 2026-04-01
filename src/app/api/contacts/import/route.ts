export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { parseCsv } from '@/lib/contacts/parse-csv';
import { parseVcf } from '@/lib/contacts/parse-vcf';
import { filterProfessional, matchContactsToVendors } from '@/lib/contacts/vendor-matcher';

/**
 * POST /api/contacts/import
 *
 * Upload a CSV or VCF file of contacts.
 * Parses, filters to professional contacts, matches against vendors.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const content = await file.text();

    // Parse contacts based on file type
    let parsed;
    let source: 'CSV_UPLOAD' | 'VCF_UPLOAD';

    if (fileName.endsWith('.csv')) {
      parsed = parseCsv(content);
      source = 'CSV_UPLOAD';
    } else if (fileName.endsWith('.vcf') || fileName.endsWith('.vcard')) {
      parsed = parseVcf(content);
      source = 'VCF_UPLOAD';
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a CSV or VCF file.' },
        { status: 400 },
      );
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: 'No contacts found in file. Check that the file has name and email columns.' },
        { status: 400 },
      );
    }

    // Create import job
    const job = await prisma.contactImportJob.create({
      data: {
        userId,
        source,
        status: 'PROCESSING',
        totalContacts: parsed.length,
      },
    });

    // Filter to professional contacts
    const professional = filterProfessional(parsed);

    // Match against vendors
    const matched = await matchContactsToVendors(professional, userId);

    // Deduplicate by email (keep first occurrence)
    const seen = new Set<string>();
    const unique = matched.filter(c => {
      const key = `${userId}:${c.email}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Also filter out contacts that already exist for this user
    const existingEmails = new Set(
      (await prisma.designerContact.findMany({
        where: { userId },
        select: { email: true },
      })).map(c => c.email)
    );
    const newContacts = unique.filter(c => !existingEmails.has(c.email));

    // Store matched contacts (not yet confirmed)
    const matchedCount = newContacts.filter(c => c.matchConfidence !== 'UNMATCHED').length;

    for (const contact of newContacts) {
      await prisma.designerContact.create({
        data: {
          userId,
          importSourceId: job.id,
          name: contact.name,
          email: contact.email,
          company: contact.company || null,
          title: contact.title || null,
          vendorOrgId: contact.vendorOrgId || null,
          vendorName: contact.vendorName || null,
          matchConfidence: contact.matchConfidence,
          isPreferredRep: false,
        },
      });
    }

    // Update job status
    await prisma.contactImportJob.update({
      where: { id: job.id },
      data: {
        status: 'AWAITING_REVIEW',
        filteredCount: professional.length,
        matchedCount,
        importedCount: newContacts.length,
        processedAt: new Date(),
      },
    });

    return NextResponse.json({
      jobId: job.id,
      totalRaw: parsed.length,
      totalFiltered: professional.length,
      matchedCount,
      importedCount: newContacts.length,
      skippedDuplicates: unique.length - newContacts.length,
    }, { status: 201 });
  } catch (error) {
    console.error('[API] /api/contacts/import error:', error);
    return NextResponse.json({ error: 'Failed to import contacts' }, { status: 500 });
  }
}
