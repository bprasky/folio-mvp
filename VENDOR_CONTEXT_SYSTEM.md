# Vendor Context System Implementation

## Overview
The vendor context system automatically infers vendor identity from the user session, auto-completing and locking vendor fields while maintaining designer/vendor parity. This ensures vendor attribution is enforced server-side rather than relying on user input.

## Key Components

### 1. Vendor Context (`src/lib/auth/vendorContext.ts`)
- **Purpose**: Retrieves vendor organization information from user session
- **Returns**: `{ vendorOrgId, vendor: { id, name, description } }`
- **Usage**: Server-side only, called in page loaders and API routes

### 2. Server Actions (`src/app/projects/[id]/_data/selectionActions.ts`)
- **Purpose**: Enforces vendor attribution in all selection operations
- **Behavior**: Overwrites any client-provided `vendorOrgId` with session-based value
- **Security**: Prevents malicious clients from impersonating other vendors

### 3. Selection Editor (`src/components/selection/SelectionEditor.tsx`)
- **Vendor Mode**: Auto-fills and locks vendor fields, shows vendor badge
- **Designer Mode**: Shows searchable vendor selector for catalog browsing
- **Context-Aware**: Different UI based on user role and vendor context

### 4. Catalog Picker (`src/components/selection/CatalogPicker.tsx`)
- **Vendor-Scoped**: Filters products to current vendor by default
- **Toggle Option**: "Browse all vendors" for designers
- **Smart Defaults**: Shows vendor's catalog first, optional expansion

### 5. Vendor Guards (`src/lib/auth/vendorGuards.ts`)
- **Authentication**: Ensures user is logged in and has VENDOR role
- **Context Validation**: Verifies vendor organization membership
- **Ownership Checks**: Prevents access to other vendors' resources

## User Experience

### Vendor Experience
- **Auto-Complete**: Vendor fields are pre-filled and locked
- **Visual Feedback**: "Sending as: {Vendor Name}" badge in header
- **Scoped Catalog**: Shows only their products by default
- **Seamless Workflow**: No manual vendor selection required

### Designer Experience
- **Full Access**: Can browse all vendors' catalogs
- **Vendor Selection**: Searchable vendor picker for catalog browsing
- **Flexible Workflow**: Can specify vendor for each selection

## Security Features

### Server-Side Enforcement
```typescript
// All API calls automatically inject vendor context
const body = {
  ...payload,
  vendorOrgId: ctx.vendorOrgId,  // Authoritative server-side value
  source: "vendor",              // Analytics tracking
};
```

### Ownership Validation
```typescript
// Prevents cross-vendor access
if (sessionVendorOrgId !== selection.vendorOrgId) {
  return new Response("Forbidden", { status: 403 });
}
```

### Context Locking
- Vendor fields are non-editable for vendors
- Server always overwrites client-provided vendor IDs
- Session-based truth over client input

## Implementation Details

### Page Integration
```typescript
// Vendor context is passed to all components
const vendorCtx = await getVendorContext();
return <HandoffComposer vendorCtx={vendorCtx} />;
```

### Component Props
```typescript
interface SelectionEditorProps {
  context: "vendor" | "designer";
  vendorCtx?: { vendorOrgId: string; vendor: { id: string; name: string } };
}
```

### API Security
- All selection operations require vendor context
- Server-side validation prevents unauthorized access
- Vendor attribution is enforced at the database level

## Benefits

1. **Security**: Server-side vendor attribution prevents impersonation
2. **UX**: Auto-complete reduces friction for vendors
3. **Parity**: Designers maintain full flexibility
4. **Consistency**: Unified vendor context across all operations
5. **Analytics**: Proper source tracking for vendor actions

## Usage Examples

### Vendor Creating Selection
- Vendor fields auto-filled and locked
- Catalog scoped to their products
- "Sending as: {Vendor Name}" badge visible

### Designer Creating Selection
- Vendor picker available for catalog browsing
- Can browse all vendors or filter to specific vendor
- Full flexibility in vendor selection

### Server-Side Validation
- All API calls automatically inject correct vendor context
- Malicious clients cannot override vendor attribution
- Ownership checks prevent cross-vendor access

The system ensures vendor identity is always inferred from the session, providing a seamless experience while maintaining security and designer/vendor parity.



