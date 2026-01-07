# Folio MVP - Comprehensive Export System Documentation

## Overview

The Folio MVP platform now includes a comprehensive export system that allows designers and administrators to generate detailed spreadsheets of all tagged materials with full project context. This system is designed to bridge the gap between inspiration, specification, and procurement documentation.

## Key Features

### 1. Room-Based Tagging
- **Enhanced Image Upload**: Each image now requires a room designation (e.g., "Master Bath", "Kitchen", "Living Room")
- **Context Preservation**: Room information is saved with each image and carried through to all exports
- **Visual Indicators**: Room names are displayed in the tagging interface for better organization

### 2. Multi-Level Export Functionality

#### A. Individual Project Exports
**Location**: Project detail pages (`/project/[id]`)
**Access**: Designers and Admins
**Features**:
- Export button in project header
- Generates CSV with all tagged materials from that specific project
- Includes project context, room information, and product details

#### B. Designer Dashboard Bulk Export
**Location**: Designer dashboard (`/designer`)
**Access**: Designers and Admins (with profile switching)
**Features**:
- "Export Materials" button exports ALL projects for the selected designer
- Comprehensive CSV including all tagged products across all projects
- Filtered by active designer profile when in admin mode

#### C. Admin Product Management Dashboard
**Location**: Admin products page (`/admin/products`)
**Access**: Admin only
**Features**:
- Complete product database with sorting and filtering
- Two specialized export types:
  - **All Product Data Export**: Complete database dump
  - **Vendor Engagement Report**: Business intelligence for vendor outreach

## Export Data Structure

### Standard Project Export Columns
```csv
Project Name, Client, Project Description, Room, Image Name, Image URL, 
Product Name, Brand, Price, Product URL, Product Description, Category, 
Vendor, Tag Coordinates, Status, Date Tagged
```

### Vendor Engagement Report Columns
```csv
Vendor Name, Total Products, Total Tags, Unique Designers, Unique Projects, 
Pending Products, Approved Products, Engagement Score
```

## Technical Implementation

### 1. Enhanced Data Models
- **ProjectImage Interface**: Added `room` field
- **ProductTag Interface**: Links to project and image context
- **PendingProduct Interface**: Tracks approval status and usage metrics

### 2. API Endpoints
- `/api/export-project-tags`: Handles individual project exports
- `/api/admin/pending-products`: Manages product approval workflow
- Enhanced existing endpoints to include room data

### 3. Export Functions
- **CSV Generation**: Client-side CSV creation with proper escaping
- **File Download**: Automatic browser downloads with descriptive filenames
- **Error Handling**: Comprehensive error management with user feedback

### 4. User Interface Components
- **Export Buttons**: Strategically placed in headers and dashboards
- **Loading States**: Visual feedback during export generation
- **Success/Error Messages**: Clear user communication

## User Workflows

### For Designers
1. **Create Project**: Upload images with room designations
2. **Tag Products**: Click-to-tag interface with room context
3. **Export Options**:
   - Individual project: Click "Export Materials" on project page
   - All projects: Click "Export Materials" on designer dashboard

### For Administrators
1. **Profile Switching**: Select designer/vendor profiles to view scoped data
2. **Bulk Management**: Access comprehensive product database
3. **Business Intelligence**: Generate vendor engagement reports
4. **Export Options**:
   - Designer-specific: Switch to designer profile and export
   - All products: Use admin products dashboard
   - Vendor reports: Generate engagement analytics

## File Naming Convention
- Individual projects: `[ProjectName]_Tagged_Materials.csv`
- Designer bulk: `[DesignerName]_All_Tagged_Materials.csv`
- All products: `Admin_All_Products_Export_[Date].csv`
- Vendor reports: `Vendor_Engagement_Report_[Date].csv`

## Business Use Cases

### 1. Project Specification
- Generate material lists for client presentations
- Create procurement documents for contractors
- Maintain project documentation for future reference

### 2. Vendor Outreach
- Identify high-engagement vendors for partnerships
- Show usage statistics to potential vendor partners
- Track product popularity across projects

### 3. Business Intelligence
- Analyze designer preferences and trends
- Track product category performance
- Monitor pending product approval workflow

## Integration Points

### 1. Project Creation Workflow
- Room field integrated into image upload process
- Validation ensures room designation before tagging
- Room data preserved throughout project lifecycle

### 2. Admin Dashboard
- New "Products" tab with direct access to export functions
- Quick stats showing pending products and vendor counts
- Seamless navigation to detailed product management

### 3. Role-Based Access
- Designers: Export their own projects and materials
- Admins: Export any designer's data plus comprehensive reports
- Profile switching maintains data security and context

## Future Enhancements

### Planned Features
1. **Automated Reports**: Scheduled exports sent via email
2. **Custom Filters**: User-defined export criteria
3. **Multiple Formats**: Excel, JSON, and PDF export options
4. **API Integration**: Direct integration with procurement systems
5. **Advanced Analytics**: Trend analysis and predictive insights

### Data Expansion
1. **Pricing History**: Track price changes over time
2. **Availability Status**: Real-time product availability
3. **Alternative Products**: Suggest similar items
4. **Vendor Contact Info**: Direct procurement contact details

## Technical Notes

### Performance Considerations
- Client-side CSV generation for responsive UX
- Chunked processing for large datasets
- Error boundaries for graceful failure handling

### Data Security
- Role-based access controls
- Sanitized CSV output to prevent injection attacks
- Audit logging for export activities

### Browser Compatibility
- Modern browser support for file downloads
- Fallback options for older browsers
- Mobile-responsive export interfaces

## Support and Maintenance

### Monitoring
- Export success/failure rates
- File size and generation time metrics
- User adoption tracking

### Maintenance Tasks
- Regular data cleanup for orphaned records
- Performance optimization for large exports
- Security updates and access control reviews

This export system transforms the Folio MVP from a simple tagging tool into a comprehensive project management and business intelligence platform, supporting the full lifecycle from inspiration to procurement. 