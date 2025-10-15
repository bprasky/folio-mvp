# RBAC + ACL Implementation Summary

## ✅ **Fixed Issues**

### **1. Vendor Context Enum Error**
- **Problem**: `getVendorContext()` used `role: "VENDOR"` which is not in `OrgUserRole` enum
- **Solution**: Removed invalid role filter, rely on `organization.type: "VENDOR"`
- **File**: `src/lib/auth/vendorContext.ts`

### **2. Proper RBAC/ACL Separation**
- **Added**: `ProjectParticipant` model for project-level access control
- **Added**: Centralized access control functions in `src/lib/authz/access.ts`
- **Added**: Proper enum usage with Prisma `$Enums`

## 🏗️ **Architecture Implemented**

### **Two-Level Authorization System**

#### **Org/Account Context (RBAC)**
- `Organization.type`: "VENDOR" vs "DESIGN_FIRM" (side discriminator)
- `OrgUserRole`: OWNER, ADMIN, MANAGER, MEMBER, VIEWER (capabilities within org)
- **Never rely on fake "VENDOR" role** - that caused the original bug

#### **Project-Level ACL (Participants)**
- `ProjectParticipant` table: `id, projectId, orgId, userId, side, role`
- `ParticipantSide`: DESIGNER | VENDOR
- `ParticipantRole`: OWNER | EDITOR | VIEWER
- Unique constraint: `(projectId, orgId, userId)`

### **Access Control Functions**

```typescript
// Centralized access checks
getProjectAccess(userId, projectId)     // Returns: {role, side, vendorOrgId}
assertProjectView(userId, projectId)    // Throws if forbidden
assertSelectionView(userId, selectionId) // Vendor-scoped selection access
assertSelectionEdit(userId, selectionId) // Edit permissions check
createProjectParticipant(...)           // Create participant entries
```

### **Object Visibility Rules**

1. **Projects**: Only visible to project participants (designer OR vendor org)
2. **Selections**: 
   - Designers see all selections
   - Vendors see only `selection.vendorOrgId == vendorCtx.vendorOrgId`
3. **Quotes**: Same rule as selections, scoped by `vendorOrgId`
4. **Rooms**: Vendors see rooms but only their own selections

## 🔧 **Implementation Details**

### **Schema Changes**
```prisma
model ProjectParticipant {
  id        String   @id @default(uuid())
  projectId String
  orgId     String?  // nullable for direct user participation
  userId    String?  // nullable for org-level participation
  side      ParticipantSide
  role      ParticipantRole @default(VIEWER)
  createdAt DateTime @default(now())
  
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  org       Organization? @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user      User? @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([projectId, orgId, userId])
}

enum ParticipantSide {
  DESIGNER
  VENDOR
}

enum ParticipantRole {
  OWNER
  EDITOR
  VIEWER
}
```

### **Handoff Acceptance Flow**
When designer accepts vendor handoff:

1. **Designer becomes project OWNER**:
   ```typescript
   createProjectParticipant(projectId, null, designerUserId, "DESIGNER", "OWNER")
   ```

2. **Vendor org gets EDITOR access**:
   ```typescript
   createProjectParticipant(projectId, vendorOrgId, null, "VENDOR", "EDITOR")
   ```

3. **Selections tagged with vendorOrgId**:
   ```typescript
   selection.vendorOrgId = vendorOrgId  // Ensures proper scoping
   ```

### **API Route Protection**
```typescript
// Example: Project route
const session = await getServerSession();
await assertProjectView(session.user.id, projectId);
// proceed with access...

// Example: Selection route  
const session = await getServerSession();
await assertSelectionView(session.user.id, selectionId);
// proceed with vendor-scoped access...
```

## 🎯 **Benefits**

1. **Security**: Server-side vendor attribution prevents impersonation
2. **Clarity**: Clear separation between org roles and project access
3. **Scalability**: Supports multi-vendor projects and complex permissions
4. **Auditability**: Proper participant tracking for enterprise features
5. **Flexibility**: Supports both user-level and org-level participation

## 🚀 **Next Steps**

1. **Run Migration**: `npx prisma migrate dev --name add_project_participants`
2. **Update API Routes**: Add access control to all project/selection/quote routes
3. **Scope Vendor UI**: Show only vendor's selections in project views
4. **Add RLS Policies**: Row-level security for defense in depth
5. **Audit Logging**: Track access patterns for enterprise reporting

## 🔍 **Testing**

- **Vendor Context**: `/vendor/create-project` should work without enum errors
- **Handoff Flow**: Designer acceptance should create proper participants
- **Access Control**: Vendors should only see their own selections
- **Permission Checks**: API routes should enforce proper access levels

The system now properly separates organizational roles from project-level access control, eliminating the enum error while providing robust, scalable authorization.




