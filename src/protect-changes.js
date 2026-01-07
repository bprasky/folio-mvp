#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to protect from reversions
const protectedFiles = [
  'app/designer/profile/page.tsx',
  'app/designer/diana-matta/page.tsx',
  'components/ProjectCreationModal.tsx',
  'app/api/projects/route.ts'
];

// Create backups of current state
function createProtectedBackups() {
  console.log('🔒 Creating protected backups of your current changes...');
  
  protectedFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      const backupPath = `${filePath}.protected`;
      fs.copyFileSync(filePath, backupPath);
      console.log(`✅ Protected: ${filePath}`);
    }
  });
}

// Restore from protected backups if files get reverted
function restoreFromProtected() {
  console.log('🔄 Checking for reverted files and restoring...');
  
  protectedFiles.forEach(filePath => {
    const protectedPath = `${filePath}.protected`;
    if (fs.existsSync(protectedPath)) {
      if (!fs.existsSync(filePath) || fs.statSync(protectedPath).mtime > fs.statSync(filePath).mtime) {
        fs.copyFileSync(protectedPath, filePath);
        console.log(`🔄 Restored: ${filePath}`);
      }
    }
  });
}

// Remove problematic backup files
function cleanBackupFiles() {
  console.log('🧹 Cleaning problematic backup files...');
  
  const backupPatterns = [
    'app/designer/profile/page.tsx.backup',
    'app/designer/profile/page_backup_.tsx',
    'app/api/projects/route.ts.backup'
  ];
  
  backupPatterns.forEach(pattern => {
    if (fs.existsSync(pattern)) {
      fs.unlinkSync(pattern);
      console.log(`🗑️  Removed: ${pattern}`);
    }
  });
}

// Main function
function protectChanges() {
  console.log('🛡️  File Protection Script Started');
  cleanBackupFiles();
  createProtectedBackups();
  console.log('✅ Your changes are now protected!');
  console.log('💡 Use "npm run dev:protected" to start development with protection');
}

// Restore function
function restoreChanges() {
  console.log('🔄 Restoring protected changes...');
  restoreFromProtected();
  console.log('✅ Changes restored!');
}

// Command line interface
const command = process.argv[2];
if (command === 'restore') {
  restoreChanges();
} else {
  protectChanges();
} 