import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
async function main(){
  const {cleanupLiveSessions}=require('../src/lib/live-interview/service');
  const {prisma}=require('../src/lib/prisma');
  try {
    if(process.argv.includes('--check')) { console.log('Standalone live cleanup imports verified. No sessions queried or changed.'); return; }
    console.log(JSON.stringify(await cleanupLiveSessions()));
  } finally { await prisma.$disconnect(); }
}
main().catch(()=>{console.error('Live session reconciliation failed; inspect provider state using the setup runbook.');process.exitCode=1;});
