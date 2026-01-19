# Trade Credential Encryption Migration Guide

**Status:** ✅ Ready for Execution
**Risk Level:** 🟢 LOW (Dual-write pattern prevents data loss)
**Estimated Time:** 30 minutes
**Rollback:** ✅ Safe (plaintext columns retained as fallback)

---

## Overview

This migration encrypts sensitive trade account credentials (username, password, API keys) using AES-256-GCM encryption. The **dual-write pattern** ensures zero data loss risk.

### What Gets Encrypted

- `VendorTradeAccount.username`
- `VendorTradeAccount.password`
- `VendorTradeAccount.apiKey`

### Migration Strategy

**Phase 1:** Add encrypted columns (✅ DONE)
**Phase 2:** Generate encryption key → Backfill data
**Phase 3:** Deploy application code (reads encrypted, writes both)
**Phase 4:** Monitor (1-2 weeks)
**Phase 5:** Remove plaintext columns (after verification)

---

## Prerequisites

- [ ] Database backup completed
- [ ] Access to production environment variables
- [ ] Secure storage for encryption key (1Password, AWS Secrets Manager, etc.)

---

## Step 1: Generate Encryption Key

Run this command to generate a secure 256-bit encryption key:

```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

**Output example:** `a1b2c3d4e5f6...` (64 hex characters)

⚠️ **CRITICAL: Save this key securely!**
- Store in 1Password / AWS Secrets Manager / HashiCorp Vault
- Losing this key = permanent data loss
- Never commit to git
- Back up in multiple secure locations

---

## Step 2: Add Encryption Key to All Environments

Add the encryption key to environment variables in **all environments**:

```bash
# Development (.env.local)
ENCRYPTION_KEY=your_generated_key_here

# Staging (via your deployment platform)
ENCRYPTION_KEY=your_generated_key_here

# Production (via your deployment platform)
ENCRYPTION_KEY=your_generated_key_here
```

**Verify it's set:**
```bash
node -e "console.log('Key set:', !!process.env.ENCRYPTION_KEY)"
```

---

## Step 3: Test Encryption (Staging Only)

Before running on production, test encryption works:

```bash
# In your Node.js console or a test script
import { testEncryption } from './src/lib/encryption';
testEncryption();
```

Expected output:
```
[Encryption Test] Starting...
[Encryption Test] Encrypted: a1b2c3d4e5f6...
[Encryption Test] Decrypted: Test password 123!@#
[Encryption Test] ✅ SUCCESS - Encryption working correctly
```

---

## Step 4: Run Database Migration

Apply the Prisma schema changes:

```bash
# Generate Prisma client with new fields
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add-encrypted-trade-credentials

# Or for production:
npx prisma migrate deploy
```

This adds the new encrypted columns (`usernameEncrypted`, `passwordEncrypted`, `apiKeyEncrypted`) without removing the old ones.

---

## Step 5: Backfill Existing Credentials

Run the migration script to encrypt existing plaintext credentials:

```bash
# Staging first (test with real data)
npx tsx scripts/migrate-trade-credentials.ts

# Production (after staging success)
npx tsx scripts/migrate-trade-credentials.ts
```

**Expected output:**
```
🔐 Starting Trade Credential Encryption Migration
============================================================
✅ Encryption key found

Found 3 account(s) with unencrypted credentials

✅ [1/3] Migrated: Acme Corp Trade Account (abc123)
✅ [2/3] Migrated: Beta LLC API Account (def456)
✅ [3/3] Migrated: Gamma Inc Portal (ghi789)

============================================================
📊 Migration Summary:
   ✅ Successful: 3
   ❌ Failed: 0
   📋 Total: 3

✅ All accounts migrated successfully!

Next steps:
1. Verify encryption is working (read credentials from app)
2. Monitor logs for decryption errors (1-2 weeks)
3. After verification, remove plaintext columns from schema
```

⚠️ **If any accounts fail:**
- Review the error messages
- Fix the issue (e.g., invalid data format)
- Re-run the script (it's idempotent - won't re-encrypt already encrypted data)

---

## Step 6: Deploy Application Code

The application code is already updated to use the dual-write pattern:

**Reading credentials:**
```typescript
import { getCredentials } from '@/lib/tradeCredentials';

const creds = await getCredentials(accountId);
// Returns decrypted values, falls back to plaintext if needed
console.log(creds.username); // Decrypted username
```

**Writing credentials:**
```typescript
import { setCredentials } from '@/lib/tradeCredentials';

await setCredentials(accountId, {
  username: 'new_username',
  password: 'new_password',
});
// Writes to BOTH plaintext and encrypted columns
```

**No code changes needed** - helpers handle everything automatically!

Deploy your application normally. The helpers will:
1. Read from encrypted columns first
2. Fall back to plaintext if decryption fails
3. Write to both columns (dual-write pattern)

---

## Step 7: Monitor & Verify (1-2 Weeks)

Monitor application logs for decryption errors:

```bash
# Search for decryption failures
grep "decryptWithFallback" logs/*.log
grep "Decryption failed" logs/*.log
```

**Expected:** No errors (all data encrypted successfully)

**If you see errors:**
- Check which account IDs are failing
- Verify encryption key is correct in that environment
- Re-run migration script for failed accounts

---

## Step 8: Remove Plaintext Columns (After Verification)

After 1-2 weeks of successful operation with no decryption errors:

**Update `prisma/schema.prisma`:**

```prisma
model VendorTradeAccount {
  // ... other fields ...

  loginUrl        String?

  // NEW (encrypted with AES-256-GCM)
  usernameEncrypted String?       // Format: iv:authTag:ciphertext
  passwordEncrypted String?       // Format: iv:authTag:ciphertext
  apiKeyEncrypted   String?       // Format: iv:authTag:ciphertext

  apiEndpoint     String?

  // REMOVED (old plaintext columns)
  // username        String?
  // password        String?
  // apiKey          String?
}
```

**Update `src/lib/tradeCredentials.ts`:**

Remove all references to `username`, `password`, `apiKey` (plaintext versions).

**Create migration:**

```bash
npx prisma migrate dev --name remove-plaintext-trade-credentials
```

⚠️ **This is destructive** - only do this after verification period!

---

## Rollback Plan

If something goes wrong:

### Immediate Rollback (Before Step 8)

The plaintext columns still exist, so:

1. **Stop using encrypted columns** - Application falls back to plaintext automatically
2. **Fix the issue** - Check encryption key, review logs
3. **Re-run migration** - Script is idempotent

### Emergency Rollback (After Step 8)

If you've already removed plaintext columns:

1. **Restore from database backup**
2. **Do NOT proceed with Step 8** until issue resolved

---

## Security Checklist

- [ ] Encryption key generated with `crypto.randomBytes(32)`
- [ ] Key stored securely (1Password / AWS Secrets Manager)
- [ ] Key added to ALL environments (dev, staging, production)
- [ ] Key backed up in multiple secure locations
- [ ] Database backup completed before migration
- [ ] Migration tested on staging first
- [ ] Application deployed and tested
- [ ] Monitoring in place for decryption errors
- [ ] Access to encryption key documented for on-call team

---

## Troubleshooting

### Error: "ENCRYPTION_KEY environment variable is not set"

**Solution:** Add `ENCRYPTION_KEY` to your environment variables (Step 2)

### Error: "ENCRYPTION_KEY must be 32 bytes"

**Solution:** Generate a new key with the command in Step 1 (must be 64 hex characters)

### Error: "Decryption failed: Invalid encrypted data format"

**Cause:** Trying to decrypt plaintext data as if it were encrypted

**Solution:** Migration script didn't run successfully. Re-run migration.

### Some accounts show "Decryption failed, using plaintext fallback"

**Cause:** Those accounts weren't migrated yet

**Solution:** Re-run `scripts/migrate-trade-credentials.ts` - it will only encrypt the missing accounts

---

## Migration Checklist

### Pre-Migration
- [ ] Read this entire document
- [ ] Database backup completed
- [ ] Encryption key generated and stored securely
- [ ] Encryption key added to all environments
- [ ] Team notified of maintenance window (if needed)

### Migration
- [ ] Prisma schema updated (`npx prisma generate`)
- [ ] Database migration applied (`npx prisma migrate deploy`)
- [ ] Backfill script run successfully (all accounts migrated)
- [ ] Application code deployed
- [ ] Manual testing: Read/write credentials works

### Post-Migration (1-2 Weeks)
- [ ] Monitor logs daily for decryption errors
- [ ] No errors for 1-2 weeks
- [ ] Remove plaintext columns (Step 8)
- [ ] Final migration applied
- [ ] Mark this task complete ✅

---

## Questions?

- **Security concerns:** Review `src/lib/encryption.ts` implementation
- **Data loss risk:** Dual-write pattern prevents this - plaintext retained as fallback
- **Performance impact:** Minimal - AES-256-GCM is fast (< 1ms per operation)
- **Key rotation:** Requires re-encrypting all data (plan separately)

---

**Last Updated:** 2026-01-19
**Version:** 1.0
**Status:** Ready for execution
