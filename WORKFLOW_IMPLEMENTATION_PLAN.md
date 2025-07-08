# Event Workflow Implementation Plan

## Current State Analysis
The described workflow is **NOT currently supported**. The existing implementation only allows admin-level event creation without the complex nested structure and approval system required.

## Required Features for Full Workflow

### 1. Database Schema Updates
**File**: `src/prisma/schema.prisma`

```prisma
// Add lender role to User model
model User {
  profileType   String    // Add "lender" to existing roles
  // ... existing fields
}

// Add parent-child relationship to Event model
model Event {
  // ... existing fields
  
  // Parent-child relationship for festivals containing events
  parentEventId String?
  parentEvent   Event?    @relation("EventHierarchy", fields: [parentEventId], references: [id])
  childEvents   Event[]   @relation("EventHierarchy")
  
  // Event type to distinguish festivals from regular events
  eventType     String    @default("event") // "festival", "event", "showcase", etc.
  
  // Approval system
  approvalStatus String   @default("pending") // "pending", "approved", "rejected"
  approvedBy    String?
  approvedAt    DateTime?
  
  // ... existing relationships
}
```

### 2. Role System Updates
**Files**: `src/contexts/RoleContext.tsx`, `src/components/RoleSelector.tsx`

```typescript
export type UserRole = 'homeowner' | 'designer' | 'vendor' | 'student' | 'admin' | 'lender';
```

### 3. API Endpoints Needed

#### A. Event Creation with Approval
**File**: `src/app/api/events/route.ts`
- Update POST endpoint to handle approval status based on user role
- Add validation for parent event selection
- Implement approval workflow

#### B. Festival-Specific Events
**File**: `src/app/api/events/[festivalId]/route.ts`
- GET: Retrieve events within a specific festival
- POST: Create event within a festival

#### C. Event Approval System
**File**: `src/app/api/events/approve/route.ts`
- PUT: Approve/reject events
- Admin-only endpoint

### 4. Frontend Components Needed

#### A. Vendor Event Creation
**File**: `src/app/vendor/create-event/page.tsx`
- Form with festival selection dropdown
- Approval status indicators
- Role-based permissions

#### B. Lender Event Creation
**File**: `src/app/lender/create-event/page.tsx`
- Similar to vendor but with lender-specific features
- Approval workflow integration

#### C. Festival Event Creation
**File**: `src/components/FestivalEventCreator.tsx`
- Embedded event creation within festival pages
- Parent festival auto-selection

#### D. Event Approval Dashboard
**File**: `src/app/admin/events/approve/page.tsx`
- List pending events
- Approve/reject functionality
- Filter by event type and creator

### 5. Updated Event Pages

#### A. Festival Detail Page
**File**: `src/app/events/[slug]/page.tsx`
- Connect to database instead of mock data
- Show nested events within festival
- Add "Create Event" button for vendors/lenders
- Display approval status

#### B. Event Listing Page
**File**: `src/app/events/page.tsx`
- Show festivals and their contained events
- Filter by event type
- Role-based create buttons

## Implementation Priority

### Phase 1: Core Infrastructure
1. ✅ Database schema updates (add lender role, parent-child events, approval system)
2. ✅ Update role system to include lender
3. ✅ Modify API endpoints for approval workflow
4. ✅ Update event creation to handle parent events

### Phase 2: User Interfaces
1. ✅ Vendor event creation page
2. ✅ Lender event creation page
3. ✅ Festival selection dropdown component
4. ✅ Event approval dashboard for admins

### Phase 3: Integration
1. ✅ Connect event pages to database
2. ✅ Add event creation buttons to festival pages
3. ✅ Implement approval notifications
4. ✅ Add role-based permissions throughout

## Workflow Steps Implementation

### Admin Creates Design Festival
```typescript
// Current: ✅ Working
// Location: /admin/create-event
// Creates festival with eventType: "festival"
```

### Vendor Creates Event in Festival
```typescript
// Required: ❌ Not implemented
// Need: /vendor/create-event with festival dropdown
// Process: Create event with parentEventId, status: "pending"
```

### Lender Creates Event for Approval
```typescript
// Required: ❌ Not implemented
// Need: /lender/create-event
// Process: Create event with status: "pending", notify admin
```

### Admin Approves Event
```typescript
// Required: ❌ Not implemented
// Need: /admin/events/approve
// Process: Update approvalStatus to "approved"
```

### Event Appears in Festival
```typescript
// Required: ❌ Not implemented
// Need: Database-driven festival pages showing approved child events
```

## Testing Checklist

### Current State Testing
- [ ] Admin can create design festival
- [ ] Festival appears in event listing
- [ ] Festival detail page loads

### Required Testing
- [ ] Vendor can access event creation
- [ ] Lender can access event creation
- [ ] Festival dropdown shows available festivals
- [ ] Events created with pending status
- [ ] Admin can approve/reject events
- [ ] Approved events appear in festival
- [ ] Role-based permissions work correctly

## Estimated Implementation Time
- **Phase 1**: 2-3 days (database and API updates)
- **Phase 2**: 3-4 days (user interfaces)
- **Phase 3**: 2-3 days (integration and testing)
- **Total**: 7-10 days for full implementation

## Critical Missing Components Summary

1. **Lender role** - Not defined in system
2. **Vendor event creation** - No interface exists
3. **Nested event structure** - Database doesn't support
4. **Approval system** - No workflow implemented
5. **Festival selection** - No dropdown component
6. **Event creation from festival pages** - No buttons/forms
7. **Database-driven event pages** - Still using mock data

The current implementation is a foundation but requires significant additional development to support the described workflow.