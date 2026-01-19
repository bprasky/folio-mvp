/**
 * Migration Script: Encrypt Trade Account Credentials
 *
 * SAFE DUAL-WRITE MIGRATION
 * This script encrypts existing plaintext credentials without data loss risk
 *
 * Usage:
 * 1. Set ENCRYPTION_KEY environment variable
 * 2. Run: npx tsx scripts/migrate-trade-credentials.ts
 * 3. Verify all accounts migrated successfully
 * 4. Monitor logs for decryption errors (1-2 weeks)
 * 5. After verification, remove plaintext columns from schema
 *
 * Safety features:
 * - Processes one account at a time (no bulk failures)
 * - Continues on error (doesn't fail entire migration)
 * - Logs all successes and failures
 * - Keeps plaintext as fallback during migration period
 */

import { prisma } from '../src/lib/prisma';
import { encrypt } from '../src/lib/encryption';

async function migrateTradeCredentials() {
  console.log('🔐 Starting Trade Credential Encryption Migration');
  console.log('=' .repeat(60));

  // Verify encryption key is set
  if (!process.env.ENCRYPTION_KEY) {
    console.error('❌ ERROR: ENCRYPTION_KEY environment variable not set');
    console.error('Generate one with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }

  console.log('✅ Encryption key found');
  console.log('');

  // Find all accounts that need migration
  const accounts = await prisma.vendorTradeAccount.findMany({
    where: {
      OR: [
        { usernameEncrypted: null, username: { not: null } },
        { passwordEncrypted: null, password: { not: null } },
        { apiKeyEncrypted: null, apiKey: { not: null } },
      ],
    },
    select: {
      id: true,
      accountName: true,
      username: true,
      password: true,
      apiKey: true,
      usernameEncrypted: true,
      passwordEncrypted: true,
      apiKeyEncrypted: true,
    },
  });

  if (accounts.length === 0) {
    console.log('✅ No accounts need migration. All credentials already encrypted!');
    return;
  }

  console.log(`Found ${accounts.length} account(s) with unencrypted credentials`);
  console.log('');

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ id: string; accountName: string; error: string }> = [];

  for (const account of accounts) {
    try {
      const updateData: any = {};

      // Encrypt username if present and not already encrypted
      if (account.username && !account.usernameEncrypted) {
        updateData.usernameEncrypted = encrypt(account.username);
      }

      // Encrypt password if present and not already encrypted
      if (account.password && !account.passwordEncrypted) {
        updateData.passwordEncrypted = encrypt(account.password);
      }

      // Encrypt API key if present and not already encrypted
      if (account.apiKey && !account.apiKeyEncrypted) {
        updateData.apiKeyEncrypted = encrypt(account.apiKey);
      }

      // Only update if there's something to encrypt
      if (Object.keys(updateData).length > 0) {
        await prisma.vendorTradeAccount.update({
          where: { id: account.id },
          data: updateData,
        });

        successCount++;
        console.log(`✅ [${successCount}/${accounts.length}] Migrated: ${account.accountName} (${account.id})`);
      } else {
        console.log(`⏭️  Skipped: ${account.accountName} (${account.id}) - Already encrypted`);
      }
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        id: account.id,
        accountName: account.accountName,
        error: errorMessage,
      });
      console.error(`❌ [${errorCount}] Failed: ${account.accountName} (${account.id})`);
      console.error(`   Error: ${errorMessage}`);
      // Continue with next account - don't fail entire migration
    }
  }

  console.log('');
  console.log('=' .repeat(60));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📋 Total: ${accounts.length}`);

  if (errors.length > 0) {
    console.log('');
    console.log('❌ Failed Accounts:');
    errors.forEach((err, index) => {
      console.log(`   ${index + 1}. ${err.accountName} (${err.id})`);
      console.log(`      Error: ${err.error}`);
    });
    console.log('');
    console.log('⚠️  WARNING: Some accounts failed to migrate.');
    console.log('   Review errors above and retry migration for failed accounts.');
  } else {
    console.log('');
    console.log('✅ All accounts migrated successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Verify encryption is working (read credentials from app)');
    console.log('2. Monitor logs for decryption errors (1-2 weeks)');
    console.log('3. After verification, remove plaintext columns from schema');
  }
}

// Run migration
migrateTradeCredentials()
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
