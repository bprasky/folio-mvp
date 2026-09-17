import { z } from 'zod';

export const HeadlineOptionsSchema = z.array(z.string().trim().min(1).max(180)).length(5);
export const BioOptionsSchema = z.array(z.string().trim().min(1).max(800)).length(4);
export const CaptionSchema = z.string().trim().min(1).max(2200);
