import { User } from '@prisma/client';
import crypto from 'crypto';

/**
 * Generate a secure random token for rep invite links
 */
export function generateSecureRandomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get the preferred email address for a rep user.
 * Uses workEmail if verified, otherwise falls back to email.
 */
export function getPreferredRepEmail(user: User): string {
  if (user.workEmail && user.workEmailVerifiedAt) {
    return user.workEmail;
  }
  return user.email;
}




