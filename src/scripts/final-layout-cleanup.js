const fs = require('fs');
const path = require('path');

console.log('🧹 Final layout cleanup - removing complex patterns...\n');

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

// Function to clean up complex layout patterns
function cleanupFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const relativePath = path.relative(path.join(process.cwd(), 'src'), filePath);
    
    // Skip layout files and non-page files
    if (relativePath.includes('layout.tsx') || 
        relativePath.includes('loading.tsx') || 
        relativePath.includes('error.tsx') ||
        relativePath.includes('components/') ||
        relativePath.includes('lib/') ||
        relativePath.includes('contexts/') ||
        relativePath.includes('api/')) {
      return false;
    }
    
    // Check if this is a page file that needs cleanup
    if (!relativePath.includes('app/') || !relativePath.includes('page.tsx')) {
      return false;
    }
    
    console.log(`📁 Processing: ${relativePath}`);
    
    // Pattern 1: Replace complex flex layouts with simple structure
    const complexLayoutPatterns = [
      // Pattern: flex h-screen overflow-hidden
      {
        pattern: /<div className="flex h-screen overflow-hidden">\s*<div className="flex-1[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      // Pattern: flex min-h-screen with flex-1
      {
        pattern: /<div className="flex min-h-screen[^"]*">\s*<div className="flex-1[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      // Pattern: flex h-screen with flex-1
      {
        pattern: /<div className="flex h-screen[^"]*">\s*<div className="flex-1[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      // Pattern: complex margin calculations
      {
        pattern: /<div className="[^"]*lg:ml-20[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      {
        pattern: /<div className="[^"]*xl:ml-56[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      // Pattern: overflow-y-auto with complex margins
      {
        pattern: /<div className="[^"]*overflow-y-auto[^"]*lg:ml-[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      }
    ];
    
    complexLayoutPatterns.forEach(({ pattern, replacement }) => {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
        console.log('  ✅ Replaced complex layout pattern');
      }
    });
    
    // Pattern 2: Add closing divs if we added opening ones
    if (modified && content.includes('max-w-7xl mx-auto')) {
      // Count opening and closing divs
      const openDivs = (content.match(/<div/g) || []).length;
      const closeDivs = (content.match(/<\/div>/g) || []).length;
      
      if (openDivs > closeDivs) {
        const missingDivs = openDivs - closeDivs;
        // Find the last closing div and add our closing divs before it
        const lastCloseDivIndex = content.lastIndexOf('</div>');
        if (lastCloseDivIndex !== -1) {
          const beforeLastDiv = content.substring(0, lastCloseDivIndex);
          const afterLastDiv = content.substring(lastCloseDivIndex);
          
          let closingDivs = '';
          for (let i = 0; i < missingDivs; i++) {
            closingDivs += '\n      </div>';
          }
          
          content = beforeLastDiv + closingDivs + afterLastDiv;
          console.log(`  ✅ Added ${missingDivs} closing div(s)`);
        }
      }
    }
    
    // Pattern 3: Clean up any remaining complex className patterns
    const complexClassPatterns = [
      /className="[^"]*flex[^"]*h-screen[^"]*overflow-hidden[^"]*"/g,
      /className="[^"]*flex[^"]*min-h-screen[^"]*flex-1[^"]*"/g,
      /className="[^"]*flex-1[^"]*lg:ml-[^"]*xl:ml-[^"]*"/g,
      /className="[^"]*overflow-y-auto[^"]*p-6[^"]*"/g
    ];
    
    complexClassPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, 'className="p-6"');
        modified = true;
        console.log('  ✅ Cleaned up complex className');
      }
    });
    
    // Pattern 4: Ensure proper structure for pages that don't have it
    if (!content.includes('p-6') && !content.includes('max-w-7xl mx-auto')) {
      // Find the main return statement and wrap content
      const returnMatch = content.match(/return\s*\(\s*<div[^>]*>/);
      if (returnMatch) {
        const beforeReturn = content.substring(0, returnMatch.index);
        const afterReturn = content.substring(returnMatch.index + returnMatch[0].length);
        
        // Find the closing div
        const closingDivIndex = afterReturn.lastIndexOf('</div>');
        if (closingDivIndex !== -1) {
          const beforeClosing = afterReturn.substring(0, closingDivIndex);
          const afterClosing = afterReturn.substring(closingDivIndex);
          
          content = beforeReturn + 
                   'return (\n    <div className="p-6">\n      <div className="max-w-7xl mx-auto">\n        ' +
                   beforeClosing + 
                   '\n      </div>\n    </div>\n  );' +
                   afterClosing;
          
          modified = true;
          console.log('  ✅ Added proper layout structure');
        }
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
  if (cleanupFile(file)) {
    modifiedCount++;
  }
  processedCount++;
});

console.log(`\n📊 Summary:`);
console.log(`  Files processed: ${processedCount}`);
console.log(`  Files modified: ${modifiedCount}`);
console.log(`  Files unchanged: ${processedCount - modifiedCount}`);

if (modifiedCount > 0) {
  console.log(`\n✅ Successfully cleaned up ${modifiedCount} files!`);
  console.log(`\n🔄 Next steps:`);
  console.log(`  1. Run 'npm run verify-layout' to check the results`);
  console.log(`  2. Test navigation on different pages`);
  console.log(`  3. Verify that the global navigation works correctly`);
} else {
  console.log(`\n✨ No files needed cleanup! The layout system is already clean.`);
} 