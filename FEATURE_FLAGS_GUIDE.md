# Feature Flags Guide

## Overview
The Folio application uses a robust feature flag system that provides clear warnings when environment variables are missing while keeping your `.env` file under your control.

## Files Created

### 1. `src/lib/flags.ts`
Core flag helper function that:
- Checks for environment variables
- Logs warnings in development when flags are missing
- Falls back to safe defaults
- Silences warnings in production

### 2. `src/lib/publicFlags.ts`
Client-side accessible flags (prefixed with `NEXT_PUBLIC_`):
- `NEXT_PUBLIC_FEATURE_VENDOR_HANDOFF`
- `NEXT_PUBLIC_FEATURE_VENDOR_VISITS`
- `NEXT_PUBLIC_FEATURE_VENDOR_QUOTES_VERSIONS`
- `NEXT_PUBLIC_FEATURE_VENDOR_DASHBOARD_V2`

### 3. Updated `src/lib/features.ts`
Server-side flags using the new flag helper:
- `FEATURE_VENDOR_HANDOFF`
- `FEATURE_VENDOR_VISITS`
- `FEATURE_VENDOR_QUOTES_VERSIONS`
- `FEATURE_VENDOR_QUICK_ACTIONS`
- `FEATURE_VENDOR_DASHBOARD_V2`

## Usage

### Server-Side (Recommended)
```typescript
import { getFeatureFlag } from '@/lib/flags';

const handoffEnabled = getFeatureFlag('FEATURE_VENDOR_HANDOFF', false);
```

### Client-Side
```typescript
import { PUBLIC_FLAGS } from '@/lib/publicFlags';

if (PUBLIC_FLAGS.FEATURE_VENDOR_HANDOFF) {
  // Show handoff UI
}
```

## Environment Variables

### To Enable Handoff System
Add to your `.env.local`:
```bash
FEATURE_VENDOR_HANDOFF=1
FEATURE_VENDOR_VISITS=1
FEATURE_VENDOR_QUOTES_VERSIONS=1
```

### URL-Based Mode Selection
The vendor create project page now supports mode-based routing:
- `/vendor/create-project` - Shows legacy project creator
- `/vendor/create-project?mode=handoff` - Shows handoff composer (if flag enabled)

## Developer Experience

### Missing Flag Warning
When a flag is missing, you'll see:
```
[FOLIO] Missing env flag: FEATURE_VENDOR_HANDOFF. Falling back to false
```

### Disabled Flag Warning
When trying to access handoff mode without the flag enabled:
```
[FOLIO] FEATURE_VENDOR_HANDOFF not enabled — showing ProjectCreator instead.
```

## Benefits

1. **No Automatic .env Injection** - You maintain full control over your environment
2. **Clear Development Warnings** - Know exactly which flags are missing
3. **Safe Fallbacks** - System continues to work with sensible defaults
4. **Production Silence** - No console warnings in production
5. **Type Safety** - Full TypeScript support
6. **Flexible Routing** - URL-based mode selection for different workflows

## Testing

1. **Without flags**: Visit `/vendor/create-project` - should show legacy creator
2. **With flags**: Visit `/vendor/create-project?mode=handoff` - should show handoff composer
3. **Missing flag warning**: Check browser console for flag warnings
4. **Disabled mode warning**: Try handoff mode without flag enabled




