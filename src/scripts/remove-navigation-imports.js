const fs = require('fs');
const path = require('path');

console.log('🧹 Removing redundant Navigation imports from individual pages...\n');

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

// Function to remove Navigation imports and usage
function removeNavigationFromFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check if file contains Navigation import
    const hasNavigationImport = content.includes('import Navigation') || 
                               content.includes('import { Navigation }') ||
                               content.includes('from \'../components/Navigation\'') ||
                               content.includes('from \'../../components/Navigation\'') ||
                               content.includes('from \'../../../components/Navigation\'') ||
                               content.includes('from \'../../../../components/Navigation\'') ||
                               content.includes('from \'../../../../../components/Navigation\'') ||
                               content.includes('from \'../../../../../../components/Navigation\'') ||
                               content.includes('from \'@/components/Navigation\'');
    
    if (!hasNavigationImport) {
      return false; // No Navigation import found
    }
    
    console.log(`📁 Processing: ${filePath}`);
    
    // Remove Navigation import lines
    const importLines = content.split('\n');
    const filteredLines = importLines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('import Navigation') && 
             !trimmed.includes('Navigation from') &&
             !trimmed.includes('Navigation,') &&
             !trimmed.includes(', Navigation');
    });
    
    if (filteredLines.length !== importLines.length) {
      content = filteredLines.join('\n');
      modified = true;
      console.log('  ✅ Removed Navigation import');
    }
    
    // Remove Navigation component usage
    const navigationUsagePatterns = [
      /<Navigation\s*\/?>/g,
      /<Navigation\s+[^>]*\/?>/g
    ];
    
    navigationUsagePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, '');
        modified = true;
        console.log('  ✅ Removed Navigation component usage');
      }
    });
    
    // Update layout structure - replace complex margin calculations with simple padding
    const layoutPatterns = [
      // Pattern 1: flex h-screen overflow-hidden with Navigation
      /<div className="flex h-screen overflow-hidden">\s*<Navigation\s*\/?>\s*<div className="flex-1[^"]*">/g,
      // Pattern 2: flex min-h-screen with Navigation
      /<div className="flex min-h-screen[^"]*">\s*<Navigation\s*\/?>\s*<div className="flex-1[^"]*">/g,
      // Pattern 3: flex h-screen with Navigation
      /<div className="flex h-screen[^"]*">\s*<Navigation\s*\/?>\s*<div className="flex-1[^"]*">/g
    ];
    
    layoutPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, '<div className="p-6">\n        <div className="max-w-7xl mx-auto">');
        modified = true;
        console.log('  ✅ Updated layout structure');
      }
    });
    
    // Add closing divs if needed
    if (modified && content.includes('max-w-7xl mx-auto')) {
      // Check if we need to add closing divs
      const openDivs = (content.match(/<div/g) || []).length;
      const closeDivs = (content.match(/<\/div>/g) || []).length;
      
      if (openDivs > closeDivs) {
        const missingDivs = openDivs - closeDivs;
        for (let i = 0; i < missingDivs; i++) {
          content += '\n      </div>';
        }
        console.log(`  ✅ Added ${missingDivs} closing div(s)`);
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log('  💾 File updated successfully');
    }
    
    return modified;
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
const srcDir = path.join(__dirname, '..');
const files = findFiles(srcDir);

console.log(`Found ${files.length} TypeScript/JavaScript files to check\n`);

let processedCount = 0;
let modifiedCount = 0;

files.forEach(file => {
  if (removeNavigationFromFile(file)) {
    modifiedCount++;
  }
  processedCount++;
});

console.log(`\n📊 Summary:`);
console.log(`  Files processed: ${processedCount}`);
console.log(`  Files modified: ${modifiedCount}`);
console.log(`  Files unchanged: ${processedCount - modifiedCount}`);

if (modifiedCount > 0) {
  console.log(`\n✅ Successfully removed redundant Navigation imports from ${modifiedCount} files!`);
  console.log(`\n🔄 Next steps:`);
  console.log(`  1. Restart your development server`);
  console.log(`  2. Test navigation on different pages`);
  console.log(`  3. Verify that the global navigation works correctly`);
} else {
  console.log(`\n✨ No redundant Navigation imports found! The layout system is already clean.`);
} 