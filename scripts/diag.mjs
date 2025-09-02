#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Helper to safely read file content
function readFileContent(path) {
  try {
    if (existsSync(path)) {
      return readFileSync(path, 'utf8');
    }
    return null;
  } catch (error) {
    return `Error reading file: ${error.message}`;
  }
}

// Helper to get package.json versions
function getPackageVersions() {
  try {
    const packageJson = JSON.parse(readFileContent(join(projectRoot, 'package.json')));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    return {
      next: deps.next,
      prisma: deps.prisma,
      '@prisma/client': deps['@prisma/client'],
      '@supabase/supabase-js': deps['@supabase/supabase-js'],
      typescript: deps.typescript
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Helper to check environment variables
function checkEnvs() {
  const envs = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'FOLIO_STORAGE_BUCKET',
    'FOLIO_ALLOW_CREATE_WITHOUT_IMAGE',
    'FOLIO_DEV_ADMIN_BYPASS',
    'FOLIO_DEV_ADMIN_SECRET',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET'
  ];
  
  return envs.map(name => ({
    name,
    present: process.env[name] !== undefined,
    length: process.env[name]?.length || 0
  }));
}

// Helper to run list-buckets script
function getBucketsInfo() {
  try {
    const bucketsScript = join(projectRoot, 'scripts', 'list-buckets.mjs');
    if (existsSync(bucketsScript)) {
      const output = execSync('node scripts/list-buckets.mjs', { 
        cwd: projectRoot, 
        encoding: 'utf8',
        timeout: 10000 
      });
      const bucketsLine = output.split('\n').find(line => line.includes('Buckets:'));
      return bucketsLine || '(no buckets line found)';
    }
    return '(skipped)';
  } catch (error) {
    return `(error: ${error.message})`;
  }
}

// Helper to find requireAdmin files
function findRequireAdminFiles() {
  const possiblePaths = [
    'src/lib/requireAdmin.ts',
    'src/lib/requireAdmin.js',
    'src/lib/requireAdmin.mjs'
  ];
  
  return possiblePaths
    .map(path => ({ path, content: readFileContent(join(projectRoot, path)) }))
    .filter(file => file.content !== null);
}

// Main diagnostic function
function generateDiagnostics() {
  const versions = getPackageVersions();
  const envs = checkEnvs();
  const bucketsInfo = getBucketsInfo();
  const requireAdminFiles = findRequireAdminFiles();
  
  const filesToCheck = [
    'prisma/schema.prisma',
    'src/app/api/admin/festivals/route.ts',
    'src/app/api/admin/events/route.ts',
    'src/lib/uploadToSupabase.ts',
    'src/lib/supabaseAdmin.ts',
    'src/lib/validators.ts'
  ];
  
  // Check for auth files
  const authFiles = [
    'src/lib/auth.ts',
    'src/app/api/auth/[...nextauth]/route.ts'
  ].map(path => ({ path, content: readFileContent(join(projectRoot, path)) }))
   .filter(file => file.content !== null);
  
  console.log('# Folio MVP Diagnostics Report');
  console.log('');
  console.log(`**Generated:** ${new Date().toISOString()}`);
  console.log('');
  
  // System Info
  console.log('## System Information');
  console.log('');
  console.log(`- **Node Version:** ${process.version}`);
  console.log('');
  
  // Package Versions
  console.log('## Package Versions');
  console.log('');
  if (versions.error) {
    console.log(`Error reading package.json: ${versions.error}`);
  } else {
    console.log('| Package | Version |');
    console.log('|---------|---------|');
    console.log(`| next | ${versions.next || 'N/A'} |`);
    console.log(`| prisma | ${versions.prisma || 'N/A'} |`);
    console.log(`| @prisma/client | ${versions['@prisma/client'] || 'N/A'} |`);
    console.log(`| @supabase/supabase-js | ${versions['@supabase/supabase-js'] || 'N/A'} |`);
    console.log(`| typescript | ${versions.typescript || 'N/A'} |`);
  }
  console.log('');
  
  // Environment Variables
  console.log('## Environment Variables');
  console.log('');
  console.log('| Variable | Present | Length |');
  console.log('|----------|---------|--------|');
  envs.forEach(env => {
    console.log(`| ${env.name} | ${env.present ? '✅' : '❌'} | ${env.length} |`);
  });
  console.log('');
  
  // Buckets Info
  console.log('## Supabase Storage Buckets');
  console.log('');
  console.log(bucketsInfo);
  console.log('');
  
  // File Contents
  console.log('## File Contents');
  console.log('');
  
  // Main files
  filesToCheck.forEach(filePath => {
    const content = readFileContent(join(projectRoot, filePath));
    console.log(`### ${filePath}`);
    console.log('');
    if (content) {
      console.log('```typescript');
      console.log(content);
      console.log('```');
    } else {
      console.log('*(file not found)*');
    }
    console.log('');
  });
  
  // Auth files
  authFiles.forEach(file => {
    console.log(`### ${file.path}`);
    console.log('');
    console.log('```typescript');
    console.log(file.content);
    console.log('```');
    console.log('');
  });
  
  // RequireAdmin files
  requireAdminFiles.forEach(file => {
    console.log(`### ${file.path}`);
    console.log('');
    console.log('```typescript');
    console.log(file.content);
    console.log('```');
    console.log('');
  });
}

// Run diagnostics
generateDiagnostics();


