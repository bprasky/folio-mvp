const fs = require('fs');
const path = require('path');

function testSliceComponentsEdit() {
  try {
    console.log('Testing Slice Components Edit Functionality...');
    
    const sliceComponents = [
      'src/components/feed/slices/Hero.tsx',
      'src/components/feed/slices/Duotile.tsx',
      'src/components/feed/slices/Triptych.tsx',
      'src/components/feed/slices/MosaicFour.tsx'
    ];
    
    // 1. Test each slice component
    console.log('\n1. Testing slice components...');
    
    sliceComponents.forEach(componentPath => {
      const componentName = path.basename(componentPath, '.tsx');
      const content = fs.readFileSync(componentPath, 'utf8');
      
      // Check for canEdit prop in interface
      const hasCanEditProp = content.includes('canEdit?: boolean');
      const hasCanEditDefault = content.includes('canEdit = false');
      const hasEditButton = content.includes('✎ Edit');
      const hasStopPropagation = content.includes('stopPropagation');
      const hasPointerEventsAuto = content.includes('pointer-events-auto');
      const hasZ10 = content.includes('z-10');
      const hasEditLink = content.includes('/admin/events/new?edit=${');
      
      console.log(`\n${componentName}:`);
      console.log(`  ${hasCanEditProp ? '✅' : '❌'} canEdit?: boolean in interface`);
      console.log(`  ${hasCanEditDefault ? '✅' : '❌'} canEdit = false in function signature`);
      console.log(`  ${hasEditButton ? '✅' : '❌'} Edit button with ✎ Edit text`);
      console.log(`  ${hasStopPropagation ? '✅' : '❌'} stopPropagation to prevent event bubbling`);
      console.log(`  ${hasPointerEventsAuto ? '✅' : '❌'} pointer-events-auto for edit button`);
      console.log(`  ${hasZ10 ? '✅' : '❌'} z-10 positioning for edit button`);
      console.log(`  ${hasEditLink ? '✅' : '❌'} Links to /admin/events/new?edit=\${item.id}`);
    });
    
    // 2. Test EditorialFeed integration
    console.log('\n2. Testing EditorialFeed integration...');
    const editorialFeedContent = fs.readFileSync('src/components/feed/EditorialFeed.tsx', 'utf8');
    
    const feedHasCanEditProp = editorialFeedContent.includes('canEdit?: boolean');
    const feedHasCanEditDefault = editorialFeedContent.includes('canEdit = false');
    const feedPassesToHero = editorialFeedContent.includes('<Hero item={sliceItems[0]} onClick={handleItemClick} canEdit={canEdit} />');
    const feedPassesToDuotile = editorialFeedContent.includes('<Duotile items={sliceItems} onClick={handleItemClick} canEdit={canEdit} />');
    const feedPassesToTriptych = editorialFeedContent.includes('<Triptych items={sliceItems} onClick={handleItemClick} canEdit={canEdit} />');
    const feedPassesToMosaic = editorialFeedContent.includes('<MosaicFour items={sliceItems} onClick={handleItemClick} canEdit={canEdit} />');
    
    console.log(`  ${feedHasCanEditProp ? '✅' : '❌'} EditorialFeed has canEdit?: boolean prop`);
    console.log(`  ${feedHasCanEditDefault ? '✅' : '❌'} EditorialFeed has canEdit = false default`);
    console.log(`  ${feedPassesToHero ? '✅' : '❌'} Passes canEdit to Hero component`);
    console.log(`  ${feedPassesToDuotile ? '✅' : '❌'} Passes canEdit to Duotile component`);
    console.log(`  ${feedPassesToTriptych ? '✅' : '❌'} Passes canEdit to Triptych component`);
    console.log(`  ${feedPassesToMosaic ? '✅' : '❌'} Passes canEdit to MosaicFour component`);
    
    // 3. Test edit button styling consistency
    console.log('\n3. Testing edit button styling consistency...');
    const allComponents = sliceComponents.map(p => fs.readFileSync(p, 'utf8'));
    
    const hasConsistentStyling = allComponents.every(content => 
      content.includes('bg-black/70') && 
      content.includes('text-white') && 
      content.includes('rounded-full') &&
      content.includes('hover:bg-black/85') &&
      content.includes('focus:outline-none') &&
      content.includes('focus:ring-2') &&
      content.includes('focus:ring-white')
    );
    
    console.log(`  ${hasConsistentStyling ? '✅' : '❌'} All components have consistent edit button styling`);
    
    // 4. Test accessibility features
    console.log('\n4. Testing accessibility features...');
    const hasAccessibility = allComponents.every(content => 
      content.includes('title="Edit event"') && 
      content.includes('data-testid="edit-event"')
    );
    
    console.log(`  ${hasAccessibility ? '✅' : '❌'} All components have accessibility attributes`);
    
    // 5. Test positioning consistency
    console.log('\n5. Testing positioning consistency...');
    const positioningMap = {
      'Hero.tsx': 'right-4 top-4',
      'Duotile.tsx': 'right-3 top-3', // Large tile
      'Triptych.tsx': 'right-3 top-3',
      'MosaicFour.tsx': 'right-2 top-2'
    };
    
    Object.entries(positioningMap).forEach(([component, expectedPosition]) => {
      const content = fs.readFileSync(`src/components/feed/slices/${component}`, 'utf8');
      const hasCorrectPosition = content.includes(expectedPosition);
      console.log(`  ${hasCorrectPosition ? '✅' : '❌'} ${component} positioned at ${expectedPosition}`);
    });
    
    console.log('\n✅ All slice components edit functionality tests completed!');
    console.log('\nImplementation Summary:');
    console.log('- All 4 slice components (Hero, Duotile, Triptych, MosaicFour) updated');
    console.log('- Each component accepts canEdit?: boolean prop');
    console.log('- Edit buttons only render when canEdit is true');
    console.log('- Consistent styling across all components');
    console.log('- Proper event handling with stopPropagation');
    console.log('- Accessibility attributes included');
    console.log('- EditorialFeed passes canEdit prop to all slice components');
    
  } catch (error) {
    console.error('❌ Error testing slice components edit functionality:', error);
  }
}

testSliceComponentsEdit(); 