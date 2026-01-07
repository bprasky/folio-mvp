-- Migration: Add Notes Attachments and Action Items
-- Created: 2025-01-27
-- Description: Extends MeetingNote with attachments and adds ActionItem model

-- Create enums
CREATE TYPE "ActionItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ActionItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- Create NoteAttachment table
CREATE TABLE "note_attachments" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "projectId" TEXT,
    "roomId" TEXT,
    "productTagId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_attachments_pkey" PRIMARY KEY ("id")
);

-- Create ActionItem table
CREATE TABLE "action_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "ActionItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "sourceNoteId" TEXT,
    "projectId" TEXT,
    "roomId" TEXT,
    "productTagId" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- Create indexes for note_attachments
CREATE INDEX "note_attachments_noteId_idx" ON "note_attachments"("noteId");
CREATE INDEX "note_attachments_projectId_idx" ON "note_attachments"("projectId");
CREATE INDEX "note_attachments_roomId_idx" ON "note_attachments"("roomId");
CREATE INDEX "note_attachments_productTagId_idx" ON "note_attachments"("productTagId");

-- Create indexes for action_items
CREATE INDEX "action_items_projectId_status_idx" ON "action_items"("projectId", "status");
CREATE INDEX "action_items_roomId_status_idx" ON "action_items"("roomId", "status");
CREATE INDEX "action_items_productTagId_status_idx" ON "action_items"("productTagId", "status");
CREATE INDEX "action_items_assignedToId_status_idx" ON "action_items"("assignedToId", "status");
CREATE INDEX "action_items_status_createdAt_idx" ON "action_items"("status", "createdAt");
CREATE INDEX "action_items_sourceNoteId_idx" ON "action_items"("sourceNoteId");

-- Add foreign key constraints for note_attachments
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "meeting_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_attachments" ADD CONSTRAINT "note_attachments_productTagId_fkey" FOREIGN KEY ("productTagId") REFERENCES "project_product_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key constraints for action_items
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_sourceNoteId_fkey" FOREIGN KEY ("sourceNoteId") REFERENCES "meeting_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_productTagId_fkey" FOREIGN KEY ("productTagId") REFERENCES "project_product_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;








