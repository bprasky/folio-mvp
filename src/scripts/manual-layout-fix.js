const fs = require('fs');
const path = require('path');

console.log('🔧 Manual layout fix - targeting specific files...\n');

// List of files that need manual fixing
const filesToFix = [
  'app/admin/festivals/create/page.tsx',
  'app/admin/vendor-analytics/page.tsx',
  'app/community/page.tsx',
  'app/designer/create/page.tsx',
  'app/designer/create-project/page.tsx',
  'app/designer/diana-matta/page.tsx',
  'app/designer/events/schedule/page.tsx',
  'app/designer/nu-projects/page.tsx',
  'app/designer/profile/page.tsx',
  'app/designer/project-tagging/page.tsx',
  'app/designer/projects/[id]/rooms/[roomId]/page.tsx',
  'app/editorials/page.tsx',
  'app/events/[id]/EventDetailClient.tsx',
  'app/homeowner/folders/page.tsx',
  'app/inspire/page.tsx',
  'app/jobs/page.tsx',
  'app/student/classes/page.tsx',
  'app/vendor/project/[id]/rooms/[roomId]/page.tsx',
  'app/watch/page.tsx',
  'app/watch/[id]/page.tsx'
];

function fixFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    console.log(`📁 Processing: ${filePath}`);
    
    // Pattern 1: Replace complex flex layouts
    const patterns = [
      // flex min-h-screen bg-gray-50 with flex-1 ml-64 lg:ml-72
      {
        pattern: /<div className="flex min-h-screen bg-gray-50">\s*<div className="flex-1 ml-64 lg:ml-72">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      // flex min-h-screen bg-gray-50 with flex-1
      {
        pattern: /<div className="flex min-h-screen bg-gray-50">\s*<div className="flex-1[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      // flex min-h-screen with flex-1
      {
        pattern: /<div className="flex min-h-screen[^"]*">\s*<div className="flex-1[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      // flex h-screen with flex-1
      {
        pattern: /<div className="flex h-screen[^"]*">\s*<div className="flex-1[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      // min-h-screen bg-primary flex with flex-1
      {
        pattern: /<div className="min-h-screen bg-primary flex">\s*<div className="flex-1[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      // Any div with ml-64
      {
        pattern: /<div className="[^"]*ml-64[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      // Any div with lg:ml-72
      {
        pattern: /<div className="[^"]*lg:ml-72[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      // Any div with xl:ml-56
      {
        pattern: /<div className="[^"]*xl:ml-56[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      },
      // Any div with lg:ml-20
      {
        pattern: /<div className="[^"]*lg:ml-20[^"]*">/g,
        replacement: '<div className="p-6">\n        <div className="max-w-7xl mx-auto">'
      }
    ];
    
    patterns.forEach(({ pattern, replacement }, index) => {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
        console.log(`  ✅ Applied pattern ${index + 1}`);
      }
    });
    
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
    } else {
      console.log('  ⏭️  No changes needed');
    }
    
    return modified;
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
let processedCount = 0;
let modifiedCount = 0;

filesToFix.forEach(file => {
  if (fixFile(file)) {
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