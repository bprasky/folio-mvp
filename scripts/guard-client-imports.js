#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const serverOnlyModules = [
  'supabaseAdmin',
  'uploadToSupabase',
  'requireEnv'
];

const clientFiles = [];
const violations = [];

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      scanDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Check if it's a client file
      if (content.includes("'use client'") || content.includes('"use client"')) {
        clientFiles.push(fullPath);
        
        // Check for server-only imports
        for (const module of serverOnlyModules) {
          if (content.includes(module)) {
            violations.push({
              file: fullPath,
              module,
              line: content.split('\n').findIndex(line => line.includes(module)) + 1
            });
          }
        }
      }
    }
  }
}

// Scan src directory
scanDirectory('./src');

if (violations.length > 0) {
  console.error('❌ CLIENT IMPORT VIOLATIONS DETECTED:');
  console.error('Server-only modules imported in client files:');
  
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line} - imports ${violation.module}`);
  }
  
  console.error('\n🚫 Build failed: Server-only modules cannot be imported in client files.');
  console.error('Move the import to a server component or API route.');
  process.exit(1);
} else {
  console.log('✅ No client import violations detected');
  console.log(`📁 Scanned ${clientFiles.length} client files`);
}


