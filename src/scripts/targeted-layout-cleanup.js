const fs = require('fs');
const path = require('path');

console.log('🎯 Targeted layout cleanup - fixing specific patterns...\n');

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

// Function to clean up specific layout patterns
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
    
    // Pattern 1: flex min-h-screen bg-gray-50 with flex-1 ml-64 lg:ml-72
    const pattern1 = /<div className="flex min-h-screen bg-gray-50">\s*<div className="flex-1 ml-64 lg:ml-72">/g;
    if (pattern1.test(content)) {
      content = content.replace(pattern1, '<div className="p-6">\n        <div className="max-w-7xl mx-auto">');
      modified = true;
      console.log('  ✅ Fixed pattern 1: flex min-h-screen bg-gray-50');
    }
    
    // Pattern 2: flex min-h-screen bg-gray-50 with flex-1
    const pattern2 = /<div className="flex min-h-screen bg-gray-50">\s*<div className="flex-1[^"]*">/g;
    if (pattern2.test(content)) {
      content = content.replace(pattern2, '<div className="p-6">\n        <div className="max-w-7xl mx-auto">');
      modified = true;
      console.log('  ✅ Fixed pattern 2: flex min-h-screen bg-gray-50 with flex-1');
    }
    
    // Pattern 3: flex min-h-screen with flex-1 and complex margins
    const pattern3 = /<div className="flex min-h-screen[^"]*">\s*<div className="flex-1[^"]*ml-[^"]*">/g;
    if (pattern3.test(content)) {
      content = content.replace(pattern3, '<div className="p-6">\n        <div className="max-w-7xl mx-auto">');
      modified = true;
      console.log('  ✅ Fixed pattern 3: flex min-h-screen with complex margins');
    }
    
    // Pattern 4: flex min-h-screen with any flex-1
    const pattern4 = /<div className="flex min-h-screen[^"]*">\s*<div className="flex-1[^"]*">/g;
    if (pattern4.test(content)) {
      content = content.replace(pattern4, '<div className="p-6">\n        <div className="max-w-7xl mx-auto">');
      modified = true;
      console.log('  ✅ Fixed pattern 4: flex min-h-screen with flex-1');
    }
    
    // Pattern 5: flex h-screen with flex-1
    const pattern5 = /<div className="flex h-screen[^"]*">\s*<div className="flex-1[^"]*">/g;
    if (pattern5.test(content)) {
      content = content.replace(pattern5, '<div className="p-6">\n        <div className="max-w-7xl mx-auto">');
      modified = true;
      console.log('  ✅ Fixed pattern 5: flex h-screen with flex-1');
    }
    
    // Pattern 6: min-h-screen bg-primary flex with flex-1
    const pattern6 = /<div className="min-h-screen bg-primary flex">\s*<div className="flex-1[^"]*">/g;
    if (pattern6.test(content)) {
      content = content.replace(pattern6, '<div className="p-6">\n        <div className="max-w-7xl mx-auto">');
      modified = true;
      console.log('  ✅ Fixed pattern 6: min-h-screen bg-primary flex');
    }
    
    // Pattern 7: Any div with ml-64 or lg:ml-72
    const pattern7 = /<div className="[^"]*ml-64[^"]*">/g;
    if (pattern7.test(content)) {
      content = content.replace(pattern7, '<div className="p-6">\n        <div className="max-w-7xl mx-auto">');
      modified = true;
      console.log('  ✅ Fixed pattern 7: ml-64 margin');
    }
    
    const pattern8 = /<div className="[^"]*lg:ml-72[^"]*">/g;
    if (pattern8.test(content)) {
      content = content.replace(pattern8, '<div className="p-6">\n        <div className="max-w-7xl mx-auto">');
      modified = true;
      console.log('  ✅ Fixed pattern 8: lg:ml-72 margin');
    }
    
    // Pattern 9: Any div with xl:ml-56
    const pattern9 = /<div className="[^"]*xl:ml-56[^"]*">/g;
    if (pattern9.test(content)) {
      content = content.replace(pattern9, '<div className="p-6">\n        <div className="max-w-7xl mx-auto">');
      modified = true;
      console.log('  ✅ Fixed pattern 9: xl:ml-56 margin');
    }
    
    // Pattern 10: Any div with lg:ml-20
    const pattern10 = /<div className="[^"]*lg:ml-20[^"]*">/g;
    if (pattern10.test(content)) {
      content = content.replace(pattern10, '<div className="p-6">\n        <div className="max-w-7xl mx-auto">');
      modified = true;
      console.log('  ✅ Fixed pattern 10: lg:ml-20 margin');
    }
    
    // Add closing divs if we added opening ones
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