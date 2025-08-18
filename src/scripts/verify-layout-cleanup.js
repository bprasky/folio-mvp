const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying layout cleanup...\n');

// Function to recursively find all TypeScript/JavaScript files
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== '.next') {
      fileList = findFiles(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to check for Navigation imports and usage
function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(path.join(process.cwd(), 'src'), filePath);
    
    // Check for Navigation imports (should only be in GlobalNavigation.tsx)
    const hasNavigationImport = content.includes('import Navigation') || 
                               content.includes('import { Navigation }') ||
                               content.includes('from \'../components/Navigation\'') ||
                               content.includes('from \'../../components/Navigation\'') ||
                               content.includes('from \'../../../components/Navigation\'') ||
                               content.includes('from \'../../../../components/Navigation\'') ||
                               content.includes('from \'../../../../../components/Navigation\'') ||
                               content.includes('from \'../../../../../../components/Navigation\'') ||
                               content.includes('from \'@/components/Navigation\'');
    
    // Check for Navigation component usage
    const hasNavigationUsage = content.includes('<Navigation') || content.includes('<Navigation/>');
    
    // Check for complex layout patterns that should be removed
    const hasComplexLayout = content.includes('flex h-screen overflow-hidden') ||
                            content.includes('flex min-h-screen') && content.includes('flex-1') ||
                            content.includes('lg:ml-20 xl:ml-56');
    
    // Check for simple layout patterns that should be present
    const hasSimpleLayout = content.includes('p-6') && content.includes('max-w-7xl mx-auto');
    
    let issues = [];
    
    if (hasNavigationImport && !relativePath.includes('GlobalNavigation.tsx')) {
      issues.push('❌ Still has Navigation import');
    }
    
    if (hasNavigationUsage && !relativePath.includes('GlobalNavigation.tsx')) {
      issues.push('❌ Still has Navigation component usage');
    }
    
    if (hasComplexLayout) {
      issues.push('⚠️  Still has complex layout patterns');
    }
    
    if (relativePath.includes('app/') && !relativePath.includes('layout.tsx') && !hasSimpleLayout && !relativePath.includes('loading.tsx') && !relativePath.includes('error.tsx')) {
      issues.push('⚠️  Missing simple layout pattern (p-6)');
    }
    
    if (issues.length > 0) {
      console.log(`📁 ${relativePath}`);
      issues.forEach(issue => console.log(`  ${issue}`));
      return issues.length;
    }
    
    return 0;
  } catch (error) {
    console.error(`❌ Error checking ${filePath}:`, error.message);
    return 1;
  }
}

// Main execution
const srcDir = path.join(__dirname, '..');
const files = findFiles(srcDir);

console.log(`Found ${files.length} TypeScript/JavaScript files to verify\n`);

let totalIssues = 0;
let filesWithIssues = 0;

files.forEach(file => {
  const issues = checkFile(file);
  if (issues > 0) {
    filesWithIssues++;
    totalIssues += issues;
  }
});

console.log(`\n📊 Verification Summary:`);
console.log(`  Files checked: ${files.length}`);
console.log(`  Files with issues: ${filesWithIssues}`);
console.log(`  Total issues found: ${totalIssues}`);

if (totalIssues === 0) {
  console.log(`\n✅ Layout cleanup verification passed! All files are properly structured.`);
  console.log(`\n🎉 Your layout system is now:`);
  console.log(`  • Using global navigation injection`);
  console.log(`  • Clean page structures with simple padding`);
  console.log(`  • No redundant Navigation imports`);
  console.log(`  • Proper responsive behavior`);
} else {
  console.log(`\n⚠️  Found ${totalIssues} issues that need attention.`);
  console.log(`\n🔄 Next steps:`);
  console.log(`  1. Review the issues above`);
  console.log(`  2. Manually fix any remaining problems`);
  console.log(`  3. Run this verification script again`);
}

// Check specific key files
console.log(`\n🔍 Key File Status:`);

const keyFiles = [
  'app/layout.tsx',
  'components/GlobalNavigation.tsx',
  'components/Navigation.tsx'
];

keyFiles.forEach(keyFile => {
  const filePath = path.join(srcDir, keyFile);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    if (keyFile === 'app/layout.tsx') {
      const hasGlobalNav = content.includes('GlobalNavigation');
      const hasMainMargin = content.includes('ml-0 lg:ml-64');
      console.log(`  ${keyFile}: ${hasGlobalNav && hasMainMargin ? '✅' : '❌'} Global navigation and margin`);
    } else if (keyFile === 'components/GlobalNavigation.tsx') {
      const hasNavigationImport = content.includes('import Navigation');
      const hasNavigationUsage = content.includes('<Navigation />');
      console.log(`  ${keyFile}: ${hasNavigationImport && hasNavigationUsage ? '✅' : '❌'} Navigation wrapper`);
    } else if (keyFile === 'components/Navigation.tsx') {
      const hasZ50 = content.includes('z-50');
      const hasFixed = content.includes('fixed');
      console.log(`  ${keyFile}: ${hasZ50 && hasFixed ? '✅' : '❌'} Fixed positioning with z-50`);
    }
  } else {
    console.log(`  ${keyFile}: ❌ File not found`);
  }
}); 