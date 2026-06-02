'use server';

/**
 * Project image workspace actions (spec 20 §3c / §11).
 *
 * Sort photos into rooms, exclude/restore them, and create rooms inline.
 * Every mutation is gated behind assertProjectWrite — the established project
 * write authz (owner, designer, org member, or admin), consistent with the
 * image delete route and the rest of the project surface.
 */

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertProjectWrite } from '@/lib/authz/access';

async function authorizeImage(imageId: string): Promise<{ id: string; projectId: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');

  const image = await prisma.projectImage.findUnique({
    where: { id: imageId },
    select: { id: true, projectId: true },
  });
  if (!image) throw new Error('Image not found');

  await assertProjectWrite(session.user.id, image.projectId);
  return image;
}

const AssignInput = z.object({
  imageId: z.string().uuid(),
  roomId: z.string().uuid(),
});

/** Assign a photo to a room. Assigning implies the photo is included. */
export async function assignImageToRoom(raw: unknown) {
  const { imageId, roomId } = AssignInput.parse(raw);
  const image = await authorizeImage(imageId);

  // Room must belong to the same project — prevents cross-project assignment.
  const room = await prisma.room.findFirst({
    where: { id: roomId, projectId: image.projectId },
    select: { id: true },
  });
  if (!room) throw new Error('Room not found for this project');

  await prisma.projectImage.update({
    where: { id: imageId },
    data: { roomId, inclusion: 'INCLUDED' },
  });

  revalidatePath(`/project/${image.projectId}`);
  return { ok: true };
}

const ImageInput = z.object({ imageId: z.string().uuid() });

/** Leave a photo out of the project. */
export async function excludeImage(raw: unknown) {
  const { imageId } = ImageInput.parse(raw);
  const image = await authorizeImage(imageId);

  await prisma.projectImage.update({
    where: { id: imageId },
    data: { inclusion: 'EXCLUDED' },
  });

  revalidatePath(`/project/${image.projectId}`);
  return { ok: true };
}

/** Bring a photo back. It returns to Uncategorized (roomId cleared). */
export async function includeImage(raw: unknown) {
  const { imageId } = ImageInput.parse(raw);
  const image = await authorizeImage(imageId);

  await prisma.projectImage.update({
    where: { id: imageId },
    data: { inclusion: 'INCLUDED', roomId: null },
  });

  revalidatePath(`/project/${image.projectId}`);
  return { ok: true };
}

/** Move an included photo back to Uncategorized (clears its room, keeps it in). */
export async function unassignImage(raw: unknown) {
  const { imageId } = ImageInput.parse(raw);
  const image = await authorizeImage(imageId);

  await prisma.projectImage.update({
    where: { id: imageId },
    data: { roomId: null },
  });

  revalidatePath(`/project/${image.projectId}`);
  return { ok: true };
}

const NoProductsInput = z.object({
  imageId: z.string().uuid(),
  value: z.boolean(),
});

/**
 * Set / clear the "no products in this photo" flag (spec 20 §3d).
 *
 * Review state is derived (`tags.length > 0 || noProducts`), so this is the
 * only persisted review signal. value=true marks a product-free shot reviewed;
 * value=false reopens it for tagging. Reversible by design — a swept photo can
 * always be brought back.
 */
export async function setImageNoProducts(raw: unknown) {
  const { imageId, value } = NoProductsInput.parse(raw);
  const image = await authorizeImage(imageId);

  await prisma.projectImage.update({
    where: { id: imageId },
    data: { noProducts: value },
  });

  revalidatePath(`/project/${image.projectId}`);
  return { ok: true };
}

const RoomNoProductsInput = z.object({
  projectId: z.string().uuid(),
  roomId: z.string().uuid(),
});

/**
 * Per-room sweep: mark every remaining untagged, INCLUDED photo in a room as
 * "no products" (spec 20 §3d, item 2). Only touches photos with zero tags, so
 * it never overrides real attribution. Reversible per-photo via
 * setImageNoProducts(false). Returns how many were swept.
 */
export async function markRoomNoProducts(raw: unknown) {
  const { projectId, roomId } = RoomNoProductsInput.parse(raw);

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  await assertProjectWrite(session.user.id, projectId);

  const room = await prisma.room.findFirst({
    where: { id: roomId, projectId },
    select: { id: true },
  });
  if (!room) throw new Error('Room not found for this project');

  const result = await prisma.projectImage.updateMany({
    where: {
      projectId,
      roomId,
      inclusion: 'INCLUDED',
      noProducts: false,
      tags: { none: {} },
    },
    data: { noProducts: true },
  });

  revalidatePath(`/project/${projectId}`);
  return { ok: true, count: result.count };
}

const RenameRoomInput = z.object({
  roomId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

/**
 * Rename a room (spec 20 follow-up). Room names are referenced in the
 * published editorial, so the designer is nudged to make them specific.
 */
export async function renameRoom(raw: unknown) {
  const { roomId, name } = RenameRoomInput.parse(raw);

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { projectId: true },
  });
  if (!room) throw new Error('Room not found');
  await assertProjectWrite(session.user.id, room.projectId);

  await prisma.room.update({ where: { id: roomId }, data: { name } });

  revalidatePath(`/project/${room.projectId}`);
  return { ok: true };
}

const CreateRoomInput = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

/** Create a room inline. Returns the new room so the caller can assign to it. */
export async function createRoom(raw: unknown) {
  const { projectId, name } = CreateRoomInput.parse(raw);

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');
  await assertProjectWrite(session.user.id, projectId);

  const room = await prisma.room.create({
    data: { projectId, name },
    select: { id: true, name: true, type: true },
  });

  revalidatePath(`/project/${projectId}`);
  return { ok: true, room };
}
