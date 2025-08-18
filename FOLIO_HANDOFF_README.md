# Folio Vendor-Designer Handoff System

## Overview
This system enables vendors to create projects for designers, populate them with selections, and hand off ownership to designers who can then organize and build presentations.

## Core Features Implemented

### 1. Organization Management
- **Organizations API**: `/api/organizations`
  - Create vendor and design firm organizations
  - Manage user roles within organizations
  - Support for different organization types (VENDOR, DESIGN_FIRM, etc.)

### 2. Project Handoff Workflow
- **Handoff API**: `/api/projects/handoff`
  - Vendors create projects and initiate handoffs
  - Designers claim project ownership
  - Track handoff status and timestamps

### 3. Project Export with CTA
- **Export API**: `/api/projects/[id]/export`
  - Generate CSV spreadsheets with product selections
  - Include call-to-action for designers to claim projects
  - Support for both CSV and JSON formats

### 4. Frontend Components
- **VendorProjectCreator**: Component for vendors to create projects
- **Project Claim Page**: Page for designers to claim project ownership
- **Vendor Dashboard**: Page for vendors to manage project creation

## Database Schema

### New Models Added
```prisma
model Organization {
  id          String   @id @default(uuid())
  name        String
  type        OrgType  @default(DESIGN_FIRM)
  description String?
  website     String?
  logo        String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  users       OrganizationUser[]
  vendorProjects Project[] @relation("VendorProjects")
  designerProjects Project[] @relation("DesignerProjects")
}

model OrganizationUser {
  id             String       @id @default(uuid())
  userId         String
  organizationId String
  role           OrgUserRole  @default(MEMBER)
  isActive       Boolean      @default(true)
  joinedAt       DateTime     @default(now())
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}
```

### Enhanced Project Model
```prisma
model Project {
  // ... existing fields ...
  vendorOrgId String?        // Organization that initiated the project
  designerOrgId String?      // Organization that will own the project
  isHandoffReady Boolean     @default(false)  // Ready for designer to claim
  handoffInvitedAt DateTime? // When handoff was initiated
  handoffClaimedAt DateTime? // When designer claimed the project
  vendorOrg   Organization?  @relation("VendorProjects", fields: [vendorOrgId], references: [id])
  designerOrg Organization?  @relation("DesignerProjects", fields: [designerOrgId], references: [id])
}
```

## Testing the System

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Test Database Connection
Visit: `http://localhost:3000/api/test-db`

### 3. Create Test Data
```bash
curl -X POST http://localhost:3000/api/test-db \
  -H "Content-Type: application/json" \
  -d '{"action": "create-test-data"}'
```

### 4. Test Vendor Project Creation
Visit: `http://localhost:3000/vendor/create-project`

### 5. Test Project Claim
Visit: `http://localhost:3000/projects/[PROJECT_ID]/claim`

## API Endpoints

### Organizations
- `GET /api/organizations` - List organizations
- `POST /api/organizations` - Create organization

### Project Handoff
- `GET /api/projects/handoff` - Get projects ready for handoff
- `POST /api/projects/handoff` - Create project and initiate handoff
- `PUT /api/projects/handoff` - Claim project ownership

### Project Export
- `GET /api/projects/[id]/export` - Export project selections as CSV

### Project Details
- `GET /api/projects/[id]` - Get project details

## User Workflow

### Vendor Workflow
1. **Create Organization**: Vendor creates or joins their organization
2. **Create Project**: Vendor creates a project for a designer
3. **Add Selections**: Vendor adds product selections to rooms
4. **Initiate Handoff**: Vendor marks project ready for handoff
5. **Share with Designer**: Vendor shares project link or CSV export

### Designer Workflow
1. **Receive Project**: Designer receives project link or CSV
2. **Review Selections**: Designer reviews vendor's selections
3. **Claim Ownership**: Designer claims project ownership
4. **Organize & Add**: Designer organizes selections and adds more
5. **Build Presentation**: Designer creates client-ready presentations

## Next Steps for Monday Testing

### Immediate Testing Needs
1. **Fix Prisma Client**: Ensure the client recognizes new schema fields
2. **Test Database**: Verify all tables are created correctly
3. **Test Handoff Flow**: End-to-end testing of vendor → designer workflow
4. **Test Export**: Verify CSV export with CTA works correctly

### Features to Add
1. **Room Management**: Add/remove rooms in projects
2. **Selection Management**: Add/edit/delete selections
3. **Photo Upload**: Allow vendors to upload product photos
4. **Notification System**: Email notifications for handoffs
5. **Presentation Builder**: Generate client-ready presentations

### Production Considerations
1. **Authentication**: Integrate with proper auth system
2. **File Storage**: Set up image/file storage
3. **Email Integration**: Send handoff invitations via email
4. **Permissions**: Implement proper access controls
5. **Validation**: Add input validation and error handling

## Current Status
- ✅ Database schema updated with organizations and handoff fields
- ✅ API endpoints created for core functionality
- ✅ Frontend components for project creation and claiming
- ⚠️ Prisma client needs refresh to recognize new schema
- ⚠️ Need to test end-to-end workflow
- ❌ Authentication integration pending
- ❌ File upload functionality pending

## Quick Start for Monday
1. Start the dev server: `npm run dev`
2. Visit `/api/test-db` to verify database connection
3. Create test data via POST to `/api/test-db`
4. Test vendor project creation at `/vendor/create-project`
5. Test project claiming at `/projects/[ID]/claim`
6. Test CSV export at `/api/projects/[ID]/export?format=csv` 