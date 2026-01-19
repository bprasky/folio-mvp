/**
 * Field-level encryption for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 *
 * IMPORTANT: ENCRYPTION_KEY must be set in environment variables
 * Generate key with: node -e "console.log(crypto.randomBytes(32).toString('hex'))"
 * Store securely in: 1Password, AWS Secrets Manager, or similar
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Throws error if key is missing or invalid
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"'
    );
  }

  try {
    const key = Buffer.from(keyHex, 'hex');

    if (key.length !== 32) {
      throw new Error(`ENCRYPTION_KEY must be 32 bytes (64 hex characters), got ${key.length} bytes`);
    }

    return key;
  } catch (error) {
    throw new Error(`Invalid ENCRYPTION_KEY format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Encrypt a plaintext string
 * Returns: iv:authTag:ciphertext (all hex-encoded)
 *
 * @param plaintext - The text to encrypt
 * @returns Encrypted string in format "iv:authTag:ciphertext"
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt an encrypted string
 * Expects format: iv:authTag:ciphertext (all hex-encoded)
 *
 * @param encryptedData - The encrypted string
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error('Cannot decrypt empty string');
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format (expected iv:authTag:ciphertext)');
    }

    const [ivHex, authTagHex, encrypted] = parts;

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Helper to safely decrypt with fallback
 * Used during migration period when some data may still be plaintext
 *
 * @param encryptedValue - Encrypted value (or null)
 * @param plaintextFallback - Plaintext fallback value (or null)
 * @returns Decrypted value, or fallback, or null
 */
export function decryptWithFallback(
  encryptedValue: string | null,
  plaintextFallback: string | null
): string | null {
  // Prefer encrypted value
  if (encryptedValue) {
    try {
      return decrypt(encryptedValue);
    } catch (error) {
      console.error('[decryptWithFallback] Decryption failed, using plaintext fallback:', error);
      return plaintextFallback;
    }
  }

  // Fallback to plaintext
  return plaintextFallback;
}

/**
 * Test encryption/decryption with sample data
 * Use this to verify encryption is working before deploying
 */
export function testEncryption(): void {
  const testData = 'Test password 123!@#';

  try {
    console.log('[Encryption Test] Starting...');

    const encrypted = encrypt(testData);
    console.log('[Encryption Test] Encrypted:', encrypted.substring(0, 50) + '...');

    const decrypted = decrypt(encrypted);
    console.log('[Encryption Test] Decrypted:', decrypted);

    if (decrypted === testData) {
      console.log('[Encryption Test] ✅ SUCCESS - Encryption working correctly');
    } else {
      console.error('[Encryption Test] ❌ FAILURE - Decrypted value does not match original');
    }
  } catch (error) {
    console.error('[Encryption Test] ❌ ERROR:', error);
  }
}
