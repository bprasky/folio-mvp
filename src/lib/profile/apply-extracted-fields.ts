import { prisma } from '@/lib/prisma';
import type { ProfileFieldSourceType } from '@prisma/client';
import type { ExtractedOrgFields, ExtractedPersonalFields } from './extract-profile-fields';

/**
 * Write extracted fields from the interview to the Organization model
 * and create ProfileFieldSource records for each extracted field.
 */
export async function applyExtractedFieldsToOrg(
  orgId: string,
  interviewId: string,
  fields: ExtractedOrgFields
) {
  const now = new Date();

  // Map extracted fields to Organization model columns
  const orgUpdate: Record<string, unknown> = {};
  if (fields.description) orgUpdate.description = fields.description;
  if (fields.tagline) orgUpdate.tagline = fields.tagline;
  if (fields.philosophy) orgUpdate.philosophy = fields.philosophy;
  if (fields.foundingYear) orgUpdate.foundedYear = fields.foundingYear;
  if (fields.city) orgUpdate.location = fields.city;
  if (fields.specialties?.length) orgUpdate.specialties = fields.specialties;

  // Update org with extracted values
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...orgUpdate,
      interviewProfileExtractedAt: now,
      profileSourcedFromInterview: true,
    },
  });

  // Build field source records for every non-null extracted field
  const fieldEntries = Object.entries(fields).filter(
    ([, value]) => value !== null && value !== undefined
  );

  // Upsert each field source record
  for (const [fieldName] of fieldEntries) {
    await prisma.profileFieldSource.upsert({
      where: {
        organizationId_fieldName: {
          organizationId: orgId,
          fieldName,
        },
      },
      create: {
        organizationId: orgId,
        fieldName,
        source: 'INTERVIEW_EXTRACTED' as ProfileFieldSourceType,
        interviewSessionId: interviewId,
        extractedAt: now,
      },
      update: {
        source: 'INTERVIEW_EXTRACTED' as ProfileFieldSourceType,
        interviewSessionId: interviewId,
        extractedAt: now,
        manuallyEditedAt: null, // reset on re-extraction
      },
    });
  }
}

/**
 * Write extracted fields from the interview to the User model
 * and create ProfileFieldSource records for each extracted field.
 */
export async function applyExtractedFieldsToUser(
  userId: string,
  interviewId: string,
  fields: ExtractedPersonalFields
) {
  const now = new Date();

  const userUpdate: Record<string, unknown> = {};
  if (fields.bio) userUpdate.bio = fields.bio;
  if (fields.title) userUpdate.title = fields.title;
  if (fields.location) userUpdate.location = fields.location;
  if (fields.studio) userUpdate.studio = fields.studio;
  if (fields.specialties?.length) userUpdate.specialties = fields.specialties;

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...userUpdate,
      interviewProfileExtractedAt: now,
      profileSourcedFromInterview: true,
    },
  });

  const fieldEntries = Object.entries(fields).filter(
    ([, value]) => value !== null && value !== undefined
  );

  for (const [fieldName] of fieldEntries) {
    await prisma.profileFieldSource.upsert({
      where: {
        userId_fieldName: {
          userId,
          fieldName,
        },
      },
      create: {
        userId,
        fieldName,
        source: 'INTERVIEW_EXTRACTED' as ProfileFieldSourceType,
        interviewSessionId: interviewId,
        extractedAt: now,
      },
      update: {
        source: 'INTERVIEW_EXTRACTED' as ProfileFieldSourceType,
        interviewSessionId: interviewId,
        extractedAt: now,
        manuallyEditedAt: null,
      },
    });
  }
}
