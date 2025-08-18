# FOLIO VENDOR WORKFLOW SPEC (STRICT, FOR CURSOR)

## Overall Goal
Build a real-data workflow where a Vendor Rep can:
1. Create a project for a Designer
2. Organize that project into Rooms (as subfolders)
3. Add products, photos, notes, and prices (line items) to each room
4. Attach quotes either at the line-item level (per product) or at the room/project level (covering multiple products)
5. Send the project to the Designer with all data passed through the DB, not dummy data
6. Designer receives a real Folio project file, sees all selections, and can accept, edit, or collaborate

## STRICT WORKFLOW FOR CURSOR

### 1. Vendor Org & Rep Setup

**Database Setup:**
```sql
-- Organizations table (already exists)
organizations: id, name, type, description, website, logo, createdAt, updatedAt

-- OrganizationUsers table (already exists)  
organization_users: id, userId, organizationId, role, isActive, joinedAt

-- Users table (already exists)
users: id, name, email, password, role, createdAt, updatedAt
```

**Workflow:**
1. Vendor signs up → creates organization account
2. System creates user + organization + organization_user relationship
3. Vendor rep is automatically OWNER of the organization

### 2. Designer Org Setup

**Database Setup:**
```sql
-- Same tables as above, but type = 'DESIGN_FIRM'
-- Designer users linked to design firm organizations
```

**Workflow:**
1. Designer signs up → creates organization account
2. System creates user + organization + organization_user relationship
3. Designer is automatically OWNER of the organization

### 3. Project File Creation by Vendor Rep

**Action:**
Vendor Rep logs in → clicks "Create New Project"

**Database Flow:**
```sql
-- Projects table (already exists, but needs vendor fields)
projects: 
  id, name, description, status, 
  vendorOrgId (FK to organizations), 
  designerOrgId (FK to organizations),
  ownerId (FK to users - vendor rep),
  isHandoffReady (boolean),
  handoffInvitedAt (timestamp),
  handoffClaimedAt (timestamp),
  createdAt, updatedAt
```

**API Endpoint:** `POST /api/projects/handoff`
**Required Fields:** name, description, vendorOrgId, designerOrgId, vendorUserId

### 4. Create Rooms (Subfolders)

**Action:**
Vendor Rep creates Rooms inside the Project File.

**Database Flow:**
```sql
-- Rooms table (already exists)
rooms: id, name, projectId (FK to projects), createdAt, updatedAt
```

**API Endpoint:** `POST /api/projects/[id]/rooms`
**Required Fields:** name, projectId

### 5. Add Line Items (Products / Materials)

**Action:**
Inside each room, Vendor Rep can add:
- Product Name
- Vendor Product ID (optional)
- Photos (uploaded)
- Notes
- Unit Price (optional, per line item)
- Quantity (optional)

**Database Flow:**
```sql
-- Selections table (already exists, but needs vendor fields)
selections:
  id, photo, vendorName, productName, colorFinish, notes,
  unitPrice (NEW FIELD), quantity (NEW FIELD),
  vendorRepId (FK to users - NEW FIELD),
  roomId (FK to rooms), projectId (FK to projects),
  timestamp, createdAt, updatedAt
```

**API Endpoint:** `POST /api/projects/[id]/rooms/[roomId]/selections`
**Required Fields:** productName, photo, roomId, projectId, vendorRepId
**Optional Fields:** vendorProductId, notes, unitPrice, quantity

### 6. Attach Quotes

**Two Types of Quote References:**

| Type | Behavior |
|------|----------|
| Line Item Quote | Each product can have its own quote attachment or reference |
| Room/Project Level Quote | Vendor can attach a single PDF quote or link that covers multiple line items or rooms |

**Database Flow:**
```sql
-- NEW TABLE: Quotes
quotes:
  id, projectId (FK to projects), 
  roomId (nullable FK to rooms), 
  selectionId (nullable FK to selections),
  quoteUrl, quoteFileName, totalAmount, notes,
  vendorRepId (FK to users),
  createdAt, updatedAt

-- Rules:
-- Room-level quote: roomId set, selectionId null
-- Line-item quote: selectionId set, roomId null  
-- Project-level quote: roomId null, selectionId null
```

**API Endpoints:**
- `POST /api/projects/[id]/quotes` (project-level)
- `POST /api/projects/[id]/rooms/[roomId]/quotes` (room-level)
- `POST /api/projects/[id]/rooms/[roomId]/selections/[selectionId]/quotes` (line-item level)

### 7. Send Project to Designer

**Action:**
Vendor clicks "Send to Designer"

**Backend Behavior:**
1. Status of Project set to "handoff_ready"
2. handoffInvitedAt timestamp set
3. isHandoffReady = true
4. Vendor Rep's info auto-attached to project metadata

**Database Updates:**
```sql
UPDATE projects 
SET isHandoffReady = true, 
    handoffInvitedAt = NOW(),
    status = 'handoff_ready'
WHERE id = ?
```

**API Endpoint:** `PUT /api/projects/[id]/send-to-designer`

**Designer Receives:**
- Project visible in Designer dashboard under "Pending Handoffs"
- Designer can accept ownership → status becomes "claimed"
- Designer can continue adding to the project
- Designer can download the quote(s) attached
- Designer can review and edit selections

### 8. Data Handshake (Real Data Required for Test)

**Flow Requirements:**
- All actions must read/write to the live Supabase database, not mocks
- Both Vendor Rep & Designer must see the same project data in real time
- Exported data (CSV, presentation, etc.) must reflect true DB state

## UX/UI Requirements (Minimal but Clear)

### Vendor Rep Flow:
1. Login → Dashboard
2. "Create New Project" button
3. Fill: Project Name, Description, Select Designer Organization
4. "Add Room" button (can add multiple rooms)
5. Click on Room → "Add Product" button
6. Fill: Product Name, Upload Photo, Notes, Price (optional), Quantity (optional)
7. "Attach Quote" button (optional)
8. Repeat steps 5-7 for each product
9. "Send to Designer" button

### Designer Flow:
1. Login → Dashboard
2. "Pending Handoffs" section
3. Click on project → "Accept Project" button
4. View project by rooms
5. View products & quotes
6. Add/edit selections
7. Download quotes

## Critical Behavior Rules (Must Implement Exactly)

| Rule | Purpose |
|------|---------|
| A Vendor can start any project, but must assign it to a designer org | To keep handshake structured |
| When Send is clicked, Folio auto-attaches the Vendor Rep info & timestamp | No manual step—this is automatic |
| Quotes can be attached per product, per room, or per project—must support all three | Real-world use demands this |
| Designer can accept, edit, or build on the project file after it's shared | This creates the collaborative loop |
| Use real DB data flow at every step (even if slower to test) | To avoid mock-based errors later |

## Database Schema Updates Required

### 1. Add fields to existing tables:
```sql
-- Add to selections table
ALTER TABLE selections ADD COLUMN unitPrice DECIMAL(10,2);
ALTER TABLE selections ADD COLUMN quantity INTEGER;
ALTER TABLE selections ADD COLUMN vendorRepId UUID REFERENCES users(id);
ALTER TABLE selections ADD COLUMN vendorProductId VARCHAR(255);
```

### 2. Create new quotes table:
```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projectId UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  roomId UUID REFERENCES rooms(id) ON DELETE CASCADE,
  selectionId UUID REFERENCES selections(id) ON DELETE CASCADE,
  quoteUrl TEXT NOT NULL,
  quoteFileName VARCHAR(255),
  totalAmount DECIMAL(10,2),
  notes TEXT,
  vendorRepId UUID NOT NULL REFERENCES users(id),
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_quotes_projectId ON quotes(projectId);
CREATE INDEX idx_quotes_roomId ON quotes(roomId);
CREATE INDEX idx_quotes_selectionId ON quotes(selectionId);
```

## API Endpoints to Implement

### Vendor Endpoints:
1. `POST /api/projects/handoff` - Create project
2. `POST /api/projects/[id]/rooms` - Add room
3. `POST /api/projects/[id]/rooms/[roomId]/selections` - Add product
4. `POST /api/projects/[id]/quotes` - Add project-level quote
5. `POST /api/projects/[id]/rooms/[roomId]/quotes` - Add room-level quote
6. `POST /api/projects/[id]/rooms/[roomId]/selections/[selectionId]/quotes` - Add line-item quote
7. `PUT /api/projects/[id]/send-to-designer` - Send project

### Designer Endpoints:
1. `GET /api/projects/handoff-ready` - Get pending handoffs
2. `PUT /api/projects/[id]/claim` - Accept project
3. `GET /api/projects/[id]` - Get project details
4. `GET /api/projects/[id]/quotes` - Get project quotes

## File Upload Requirements

### Photo Upload:
- Use existing `/api/videos/upload` endpoint
- Store photo URLs in selections.photo field
- Support multiple photos per product

### Quote Upload:
- Use existing `/api/videos/upload` endpoint
- Store quote URLs in quotes.quoteUrl field
- Support PDF, DOC, DOCX formats

## Testing Requirements

### Real Data Testing:
1. Create real vendor organization
2. Create real designer organization
3. Create real project with real data
4. Test handshake from vendor to designer
5. Verify all data persists correctly
6. Test quote attachments work
7. Test project claiming works

### Performance Testing:
1. Test with multiple rooms (5+)
2. Test with multiple products per room (10+)
3. Test with multiple quotes
4. Verify real-time data sync

## Final Notes to Cursor

This is a strict operating workflow for real-world raw testing starting next week.
- Focus on real data, real handshake testing, and role-based interactions
- Minimize placeholder logic
- Prioritize accuracy of the workflow over speed of testing
- Use existing Prisma schema and extend it as needed
- All database operations must use Prisma ORM
- No mock data allowed - everything must be real Supabase data 