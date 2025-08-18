# Global Layout System Documentation

## Overview

This document describes the refactored layout system that ensures the navigation sidebar is globally injected through `app/layout.tsx` and all pages render cleanly inside the layout without defining any navigation logic themselves.

## Architecture

### 1. Root Layout (`app/layout.tsx`)

The root layout is responsible for:
- Injecting the global navigation sidebar
- Providing proper spacing for content
- Handling responsive behavior

```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-folio-background text-folio-text min-h-screen`}>
        <Providers>
          <SessionRoleSync />
          {/* Global Navigation Sidebar - Fixed position with z-50 */}
          <GlobalNavigation />
          {/* Main Content Area - Left margin to prevent overlap with sidebar */}
          <main className="bg-folio-background ml-0 lg:ml-64 transition-all duration-300 min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
```

### 2. Global Navigation Component (`components/GlobalNavigation.tsx`)

The GlobalNavigation component:
- Wraps the main Navigation component
- Handles loading states
- Can be configured to show/hide on specific pages (e.g., auth pages)
- Provides consistent navigation across all routes

```tsx
const GlobalNavigation = () => {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // Check if we're on an auth page where we might want to suppress navigation
  const isAuthPage = pathname?.startsWith('/auth/');
  
  // For now, show navigation on all pages including auth pages
  const shouldShowNavigation = true;

  // Show loading state while session is being determined
  if (status === 'loading') {
    return (
      <div className="fixed top-0 left-0 h-screen w-64 z-50 bg-white border-r border-folio-border shadow-sm">
        {/* Loading skeleton */}
      </div>
    );
  }

  if (!shouldShowNavigation) {
    return null;
  }

  return <Navigation />;
};
```

### 3. Navigation Component (`components/Navigation.tsx`)

The main Navigation component:
- Fixed position with `z-50` for proper layering
- Width of 256px (`w-64`)
- Full height (`h-full`)
- Role-based navigation items
- Dynamic content based on user session

```tsx
return (
  <div className="bg-white border-r border-folio-border w-64 p-6 fixed h-full z-50 flex flex-col shadow-sm">
    {/* Logo */}
    <div className="mb-8">
      <FolioLogo size="md" variant="combined" />
    </div>

    {/* Navigation Links */}
    <nav className="flex-1 flex flex-col space-y-2">
      {/* Role-based navigation items */}
    </nav>

    {/* User section */}
  </div>
);
```

## Key Features

### 1. Fixed Positioning
- Sidebar uses `fixed` position with `z-50`
- Content area uses `ml-0 lg:ml-64` for proper spacing
- Responsive behavior with `lg:` breakpoint

### 2. Dynamic Role-Based Navigation
- Navigation items change based on user role (admin, vendor, designer, etc.)
- Session-based role detection
- Proper fallback to guest navigation

### 3. Clean Page Structure
- Pages no longer need to import or use Navigation components
- Simple content structure with `p-6` padding
- Maximum width container with `max-w-7xl mx-auto`

### 4. Responsive Design
- Mobile: No sidebar margin (`ml-0`)
- Desktop: 256px left margin (`lg:ml-64`)
- Smooth transitions with `transition-all duration-300`

## Page Structure Guidelines

### Before (Old Pattern)
```tsx
// ❌ Don't do this anymore
import Navigation from '../../components/Navigation';

export default function SomePage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Navigation />
      <div className="flex-1 lg:ml-20 xl:ml-56 overflow-y-auto p-6">
        {/* Content */}
      </div>
    </div>
  );
}
```

### After (New Pattern)
```tsx
// ✅ Do this instead
export default function SomePage() {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Content */}
      </div>
    </div>
  );
}
```

## Implementation Steps

### 1. Run the Cleanup Script
```bash
npm run clean-layout
```

This script will:
- Remove all redundant Navigation imports
- Update layout structures
- Add proper closing divs
- Provide a summary of changes

### 2. Verify the Layout
After running the script, verify that:
- No pages import Navigation components
- All pages use simple `p-6` padding
- Content is properly spaced from the sidebar
- Navigation works on all routes

### 3. Test Different Routes
Test the layout on:
- Static pages (e.g., `/`, `/events`)
- Dynamic pages (e.g., `/vendor/project/[id]`)
- Admin routes (e.g., `/admin/dashboard`)
- Vendor routes (e.g., `/vendor/dashboard`)
- Designer routes (e.g., `/designer/projects`)

## Troubleshooting

### Common Issues

1. **Content Overlapping Sidebar**
   - Ensure pages use `p-6` padding
   - Check that root layout has `ml-0 lg:ml-64`

2. **Navigation Not Showing**
   - Verify GlobalNavigation is imported in root layout
   - Check session status and role assignment
   - Ensure z-index is set to `z-50`

3. **Layout Breaking on Mobile**
   - Verify responsive classes: `ml-0 lg:ml-64`
   - Check that sidebar has proper mobile behavior

### Debug Commands

```bash
# Check for remaining Navigation imports
grep -r "import Navigation" src/app/

# Check for Navigation component usage
grep -r "<Navigation" src/app/

# Test role assignment
npm run test-roles
```

## Benefits

1. **Consistency**: Same navigation on every page
2. **Maintainability**: Centralized navigation logic
3. **Performance**: Single navigation instance
4. **Clean Code**: Pages focus on content, not layout
5. **Responsive**: Works on all screen sizes
6. **Role-Based**: Dynamic navigation per user type

## Migration Checklist

- [ ] Run `npm run clean-layout`
- [ ] Verify no Navigation imports remain
- [ ] Test navigation on all user roles
- [ ] Check responsive behavior
- [ ] Verify dynamic routes work
- [ ] Test auth pages (if navigation should be hidden)
- [ ] Ensure proper z-index layering
- [ ] Verify smooth transitions

## Support

If you encounter issues with the layout system:
1. Check the console for errors
2. Verify session and role assignment
3. Run the cleanup script again
4. Check that all pages follow the new pattern 