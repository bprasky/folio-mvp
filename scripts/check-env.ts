import { requireEnv } from '../src/lib/env';

const { PROD_DATABASE_URL, SHADOW_DATABASE_URL, NODE_ENV } = process.env;

try {
  const DATABASE_URL = requireEnv('DATABASE_URL');
  
  if (PROD_DATABASE_URL && DATABASE_URL === PROD_DATABASE_URL) {
    console.error('❌ DATABASE_URL equals PROD_DATABASE_URL — fix your envs.'); 
    process.exit(1);
  }

  if (SHADOW_DATABASE_URL && (SHADOW_DATABASE_URL === DATABASE_URL || SHADOW_DATABASE_URL === PROD_DATABASE_URL)) {
    console.error('❌ SHADOW_DATABASE_URL must be unique.'); 
    process.exit(1);
  }

  console.log(`✅ Env check OK for ${NODE_ENV || 'unknown env'}.`);
  console.log(`📊 DATABASE_URL: Set`);
  console.log(`🚀 PROD_DATABASE_URL: ${PROD_DATABASE_URL ? 'Set' : 'Not set'}`);
  console.log(`🔄 SHADOW_DATABASE_URL: ${SHADOW_DATABASE_URL ? 'Set' : 'Not set'}`);
} catch (error) {
  console.error('❌ Environment validation failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}
