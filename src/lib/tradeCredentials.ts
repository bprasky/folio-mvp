/**
 * Trade Account Credentials Helper
 * Implements dual-write pattern for safe migration to encrypted credentials
 *
 * Usage:
 * - Use getCredentials() to read (handles fallback automatically)
 * - Use setCredentials() to write (writes to both plaintext and encrypted)
 * - After migration complete, update to use encrypted-only
 */

import { prisma } from './prisma';
import { encrypt, decryptWithFallback } from './encryption';

export interface TradeCredentials {
  username: string | null;
  password: string | null;
  apiKey: string | null;
}

/**
 * Get trade account credentials (with encryption fallback)
 * Prefers encrypted values, falls back to plaintext during migration period
 *
 * @param accountId - VendorTradeAccount ID
 * @returns Credentials object with decrypted values
 */
export async function getCredentials(accountId: string): Promise<TradeCredentials> {
  const account = await prisma.vendorTradeAccount.findUnique({
    where: { id: accountId },
    select: {
      username: true,
      password: true,
      apiKey: true,
      usernameEncrypted: true,
      passwordEncrypted: true,
      apiKeyEncrypted: true,
    },
  });

  if (!account) {
    throw new Error(`Trade account not found: ${accountId}`);
  }

  return {
    username: decryptWithFallback(account.usernameEncrypted, account.username),
    password: decryptWithFallback(account.passwordEncrypted, account.password),
    apiKey: decryptWithFallback(account.apiKeyEncrypted, account.apiKey),
  };
}

/**
 * Set trade account credentials (dual-write pattern)
 * Writes to BOTH plaintext and encrypted columns for safety during migration
 *
 * @param accountId - VendorTradeAccount ID
 * @param credentials - Credentials to store
 */
export async function setCredentials(
  accountId: string,
  credentials: Partial<TradeCredentials>
): Promise<void> {
  const updateData: any = {};

  // Username - write to both old and new
  if (credentials.username !== undefined) {
    if (credentials.username) {
      updateData.username = credentials.username;           // OLD (plaintext)
      updateData.usernameEncrypted = encrypt(credentials.username); // NEW (encrypted)
    } else {
      updateData.username = null;
      updateData.usernameEncrypted = null;
    }
  }

  // Password - write to both old and new
  if (credentials.password !== undefined) {
    if (credentials.password) {
      updateData.password = credentials.password;           // OLD (plaintext)
      updateData.passwordEncrypted = encrypt(credentials.password); // NEW (encrypted)
    } else {
      updateData.password = null;
      updateData.passwordEncrypted = null;
    }
  }

  // API Key - write to both old and new
  if (credentials.apiKey !== undefined) {
    if (credentials.apiKey) {
      updateData.apiKey = credentials.apiKey;               // OLD (plaintext)
      updateData.apiKeyEncrypted = encrypt(credentials.apiKey);     // NEW (encrypted)
    } else {
      updateData.apiKey = null;
      updateData.apiKeyEncrypted = null;
    }
  }

  await prisma.vendorTradeAccount.update({
    where: { id: accountId },
    data: updateData,
  });
}

/**
 * Create a new trade account with encrypted credentials
 * Uses dual-write pattern to maintain backward compatibility
 */
export async function createTradeAccount(data: {
  vendorOrgId: string;
  accountName: string;
  accountType: string;
  username?: string;
  password?: string;
  apiKey?: string;
  loginUrl?: string;
  apiEndpoint?: string;
  discountPercent: number;
  paymentTerms?: string;
  minOrderCents?: number;
  maxOrderCents?: number;
  repName?: string;
  repEmail?: string;
  repPhone?: string;
}): Promise<any> {
  const createData: any = {
    vendorOrgId: data.vendorOrgId,
    accountName: data.accountName,
    accountType: data.accountType,
    loginUrl: data.loginUrl,
    apiEndpoint: data.apiEndpoint,
    discountPercent: data.discountPercent,
    paymentTerms: data.paymentTerms,
    minOrderCents: data.minOrderCents,
    maxOrderCents: data.maxOrderCents,
    repName: data.repName,
    repEmail: data.repEmail,
    repPhone: data.repPhone,
  };

  // Dual-write: Set both plaintext and encrypted
  if (data.username) {
    createData.username = data.username;
    createData.usernameEncrypted = encrypt(data.username);
  }

  if (data.password) {
    createData.password = data.password;
    createData.passwordEncrypted = encrypt(data.password);
  }

  if (data.apiKey) {
    createData.apiKey = data.apiKey;
    createData.apiKeyEncrypted = encrypt(data.apiKey);
  }

  return await prisma.vendorTradeAccount.create({
    data: createData,
  });
}
