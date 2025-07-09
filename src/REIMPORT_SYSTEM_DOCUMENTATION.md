# 🔄 Portfolio Reimport System Documentation

## 🎯 Overview

The Portfolio Reimport System allows designers to reimport their portfolio from their website in case the initial import fails or needs to be updated. This system ensures that designer profiles are built out completely to match the current designer profile structure.

## ✨ Key Features

### 🔧 Enhanced Profile Creation
- **Complete Profile Structure**: Enhanced signup creates profiles with all required fields
- **Scraped Data Integration**: Automatically populates bio, logo, specialties, and projects
- **Event Attribution**: Tracks signup source and event information
- **Legacy Support**: Maintains compatibility with existing designer profiles

### 🔄 Reimport Functionality
- **One-Click Reimport**: Simple button in designer dashboard
- **Smart Updates**: Updates existing projects and adds new ones
- **Image Management**: Preserves existing images and adds new ones
- **Error Handling**: Comprehensive error messages and validation

### 🎯 Project-Specific Tagging
- **Import-Only Tagging**: Only imported/posted photos can be tagged
- **No Demo Images**: Removed generic demo images from tagging interface
- **Project Selection**: Users select from their imported projects
- **Image Selection**: Users select specific images within projects

## 🛠️ Technical Implementation

### Enhanced Signup API (`/api/auth/signup/designer`)
```typescript
// Creates complete user profile with scraped data
const user = await prisma.user.create({
  data: {
    email,
    name: scrapedData?.companyName || 'Designer',
    profileType: 'designer',
    website,
    bio: scrapedData?.about || null,
    profileImage: scrapedData?.logo || null,
    location: null,
    specialties: scrapedData?.projects?.map(p => p.category).filter(Boolean) || [],
    instagram: null,
    linkedin: null,
    followers: 0,
    views: 0
  }
});
```

### Reimport API (`/api/reimport-portfolio`)
```typescript
// Reimports portfolio from website
export async function POST(request: NextRequest) {
  const { userId, website } = await request.json();
  
  // Scrape website
  const scrapedData = await scrapeDesignerWebsite(website);
  
  // Update user profile
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: scrapedData.companyName || user.name,
      bio: scrapedData.about || user.bio,
      profileImage: scrapedData.logo || user.profileImage,
      specialties: scrapedData.projects?.map(p => p.category).filter(Boolean) || user.specialties
    }
  });
  
  // Process projects (create new or update existing)
  // Return results
}
```

### Project-Specific Tagging Page (`/designer/project-tagging`)
- **Fetches User Projects**: Only shows imported projects
- **Project Selection**: Users choose which project to tag
- **Image Selection**: Users choose which image within the project
- **No Demo Images**: Removed all demo/generic images
- **Error Handling**: Shows helpful messages if no projects exist

## 🎮 User Experience

### Initial Onboarding Flow
1. **Enhanced Signup**: Designer enters email, password, and website
2. **Automatic Scraping**: System scrapes website for portfolio data
3. **Profile Creation**: Complete profile created with scraped data
4. **Project Import**: Projects and images imported automatically
5. **Onboarding Complete**: Redirected to project tagging

### Reimport Process
1. **Access Dashboard**: Designer goes to designer dashboard
2. **Click Reimport**: Clicks "Reimport Portfolio" button
3. **Confirmation**: Confirms reimport action
4. **Scraping**: System re-scrapes website
5. **Updates**: Existing projects updated, new ones created
6. **Success**: Shows results and refreshes project list

### Project Tagging Workflow
1. **Select Project**: Choose from imported projects
2. **Select Image**: Choose specific image within project
3. **Tag Products**: Click on image to tag products
4. **Earn Commissions**: Tagged products generate revenue

## 🔧 API Endpoints

### POST `/api/auth/signup/designer`
Creates new designer account with enhanced profile data.

**Request Body:**
```json
{
  "email": "designer@example.com",
  "password": "password123",
  "website": "https://designer.com",
  "eventId": "optional-event-id",
  "scrapedData": {
    "companyName": "Design Studio",
    "about": "About the studio...",
    "logo": "https://example.com/logo.jpg",
    "projects": [...]
  }
}
```

### POST `/api/reimport-portfolio`
Reimports portfolio from website.

**Request Body:**
```json
{
  "userId": "user-id",
  "website": "https://designer.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Portfolio reimported successfully",
  "projectsCreated": 3,
  "projectsUpdated": 1,
  "totalProjects": 4
}
```

## 📊 Database Schema

### User Model (Enhanced)
```prisma
model User {
  id            String    @id @default(uuid())
  email         String?   @unique
  name          String
  bio           String?           // From scraped data
  profileImage  String?           // From scraped logo
  profileType   String
  location      String?
  specialties   String[]          // From scraped project categories
  website       String?
  instagram     String?
  linkedin      String?
  followers     Int       @default(0)
  views         Int       @default(0)
  
  // Event tracking
  signupSource  String?
  signupDate    DateTime?
  
  // Relationships
  designerProjects Project[]
}
```

### Project Model
```prisma
model Project {
  id          String    @id @default(uuid())
  name        String
  description String?
  category    String?
  client      String?
  status      String    @default("draft")
  designerId  String
  designer    User      @relation("DesignerProjects", fields: [designerId], references: [id])
  images      ProjectImage[]
}
```

## 🎯 Business Value

### For Designers
- **Zero-Friction Onboarding**: Quick signup with automatic portfolio import
- **Troubleshooting**: Easy reimport if initial import fails
- **Revenue Generation**: Tag products in their own portfolio images
- **Professional Profile**: Complete profile structure for credibility

### For Platform
- **Higher Conversion**: Reduced friction in designer onboarding
- **Quality Content**: Only real portfolio images can be tagged
- **Event Attribution**: Track which events drive signups
- **Data Quality**: Complete profiles improve platform value

### For Vendors
- **Authentic Context**: Products tagged in real project images
- **Higher Conversion**: Real project context drives sales
- **Designer Credibility**: Professional portfolios increase trust

## 🚀 Getting Started

### For Developers
1. **Test Enhanced Signup**: Use `/signup/designer/enhanced` page
2. **Test Reimport**: Use "Reimport Portfolio" button in designer dashboard
3. **Test Tagging**: Visit `/designer/project-tagging` with imported projects

### For Designers
1. **Complete Onboarding**: Go through enhanced signup process
2. **Verify Import**: Check that projects and images imported correctly
3. **Start Tagging**: Visit project tagging page to tag products
4. **Reimport if Needed**: Use reimport button if initial import fails

## 🔮 Future Enhancements

- **Incremental Updates**: Only update changed projects/images
- **Batch Processing**: Handle large portfolios more efficiently
- **AI Enhancement**: Use AI to improve scraped data quality
- **Analytics**: Track import success rates and common issues
- **Notifications**: Alert designers when reimport completes

## 🐛 Troubleshooting

### Common Issues
1. **404 on Reimport API**: Check if route file exists and server is running
2. **Scraping Failures**: Verify website is accessible and has portfolio content
3. **Profile Incomplete**: Ensure enhanced signup is being used
4. **No Projects**: Check if website has portfolio/projects section

### Debug Steps
1. Check server logs for API errors
2. Verify website scraping with test script
3. Check database for imported data
4. Test reimport functionality manually

## 📝 Testing

Run the test script to verify system functionality:
```bash
node scripts/test-reimport.js
```

This will test:
- Reimport API endpoint accessibility
- Designer profile structure completeness
- Project tagging integration
- Enhanced signup functionality 