# Smart Designer Onboarding System

## Overview

The Smart Designer Onboarding System enables designers to create complete Folio profiles in under 3 minutes by automatically scraping their existing websites and importing portfolio content. This system is specifically designed for live events where designers can scan a QR code and walk away with a fully functional profile.

## 🎯 Key Features

- **QR Code Triggered Signup**: Event-specific signup URLs with attribution tracking
- **Website Scraping**: Automatic extraction of portfolio, team, and about information
- **Smart Content Import**: Converts website content into structured Folio data
- **Fallback System**: Graceful degradation to mock data if scraping fails
- **Event Attribution**: Track which events drive the most signups
- **Analytics**: Comprehensive tracking of onboarding funnel and success rates

## 🏗️ System Architecture

### Frontend Flow
```
QR Code Scan → /signup/designer?event=nycx2025
     ↓
Step 1: Email + Password + Website URL
     ↓
Step 2: Website Scraping (with loading animation)
     ↓
Step 3: Preview Imported Data
     ↓
Step 4: Complete Signup → /designer/onboarding-complete
     ↓
Dashboard with "Start Tagging" prompt
```

### Backend Components
- **`/api/scrape-website`**: Browserless-powered web scraper
- **`/api/auth/signup/designer`**: User creation with scraped data
- **`/api/designers/[id]/onboarding`**: Fetch onboarding data
- **`lib/scraper/browserless.ts`**: Core scraping logic

## 🔧 Technical Implementation

### 1. Website Scraping Engine

**File**: `lib/scraper/browserless.ts`

Uses Browserless.io for headless browser scraping with intelligent content extraction:

```typescript
// Extracts from common designer website patterns
const aboutSelectors = [
  'section.about', '#about', '.about', '[class*="bio"]'
];

const teamSelectors = [
  'section[class*="team"]', '.team', '[class*="team"]'
];

const portfolioSelectors = [
  'section[class*="portfolio"]', '.portfolio', '[class*="projects"]'
];
```

**Features**:
- Multiple selector strategies for different website structures
- Image filtering (size, relevance)
- Fallback to mock data if scraping fails
- Comprehensive error handling

### 2. Database Schema

**New Models**:
- `DesignerProfile`: Extended designer information
- `OnboardingCompletion`: Track onboarding progress
- `EventSignup`: Event attribution tracking
- `WebsiteScrape`: Scraping attempt logging

**Key Fields**:
```sql
-- User table additions
eventSignupId String?
signupSource String? -- "event", "website", "referral"
signupDate DateTime?

-- DesignerProfile
about String?
logo String?
team String? -- JSON array
specialties String[]
```

### 3. API Endpoints

#### POST `/api/scrape-website`
```json
{
  "url": "https://designer-website.com",
  "eventId": "nycx2025"
}
```

**Response**:
```json
{
  "about": "Studio description...",
  "team": [
    {"name": "Sarah Johnson", "role": "Principal Designer", "image": "..."}
  ],
  "projects": [
    {
      "title": "Modern Apartment",
      "description": "Project description",
      "images": ["url1", "url2"],
      "category": "Residential"
    }
  ],
  "logo": "logo-url",
  "companyName": "Studio Name"
}
```

#### POST `/api/auth/signup/designer`
Creates user account and imports scraped data into:
- User profile
- Designer profile
- Projects with images
- Onboarding completion record
- Event signup tracking

## 🎫 Event Integration

### QR Code Generation

**Script**: `scripts/generate-event-qr.js`

```bash
# Generate QR for specific event
node scripts/generate-event-qr.js nycxdesign-2025 "NYCxDesign 2025"

# Generate all event QR codes
node scripts/generate-event-qr.js --all
```

**Output**: PNG files in `/public/qr-codes/`

### Event Attribution

QR codes link to: `/signup/designer?event=nycxdesign-2025`

This automatically:
- Pre-fills event context
- Tracks signup source
- Links user to event for analytics
- Enables event-specific onboarding flows

## 📊 Analytics & Tracking

### Scraping Analytics
- Success/failure rates by website type
- Content extraction success rates
- Processing time metrics
- Error categorization

### Onboarding Funnel
- QR scan → signup completion rate
- Website scraping success rate
- Profile completion rate
- First tagging action rate

### Event Performance
- Signups per event
- Conversion rates by event type
- Geographic distribution
- Time-to-first-tagging

## 🚀 Production Setup

### 1. Environment Variables
```bash
# .env
BROWSERLESS_TOKEN=your_browserless_token_here
DATABASE_URL=your_database_url
```

### 2. Browserless Configuration
- Sign up at [browserless.io](https://browserless.io)
- Get API token
- Configure rate limits and timeouts

### 3. Database Migration
```bash
npx prisma db push
npx prisma generate
```

### 4. Testing
```bash
# Test scraper functionality
node scripts/test-scraper.js

# Generate event QR codes
node scripts/generate-event-qr.js --all
```

## 🎨 User Experience

### Designer Journey
1. **Scan QR Code** at event booth
2. **Enter Basic Info** (email, password, website)
3. **Watch Import** (animated loading with progress)
4. **Review Preview** (see imported content)
5. **Complete Signup** (land on dashboard)
6. **Start Tagging** (immediate value proposition)

### Event Staff Workflow
1. **Print QR Codes** for each event
2. **Place at Booths** and registration areas
3. **Monitor Signups** via admin dashboard
4. **Follow Up** with designers who completed signup

## 🔄 Fallback Strategy

### Scraping Failures
1. **Primary**: Browserless scraping
2. **Fallback**: Mock data with helpful message
3. **Manual**: Designer can edit profile later

### Error Handling
- Network timeouts (60s)
- Invalid URLs
- Blocked scraping
- Malformed content
- Rate limiting

## 📈 Success Metrics

### Immediate Metrics
- QR scan to signup completion: Target 70%+
- Website scraping success: Target 80%+
- Profile completion rate: Target 90%+

### Long-term Metrics
- Time to first tagging: Target <24 hours
- Event attribution ROI
- Designer retention rates
- Revenue per event signup

## 🛠️ Maintenance

### Regular Tasks
- Monitor scraping success rates
- Update selector patterns for new website structures
- Review and optimize fallback content
- Analyze event performance data

### Scaling Considerations
- Browserless rate limits
- Database performance with high signup volumes
- CDN for imported images
- Caching strategies for repeated scrapes

## 🎯 Future Enhancements

### AI-Powered Features
- Content categorization
- Project description generation
- Image quality assessment
- Duplicate detection

### Advanced Scraping
- Multi-page portfolio extraction
- Social media integration
- Contact information extraction
- Project categorization

### Event Features
- Real-time signup notifications
- Event-specific onboarding flows
- Integration with event management platforms
- Post-event follow-up automation

---

## Quick Start for Events

1. **Generate QR Codes**: `node scripts/generate-event-qr.js --all`
2. **Print & Distribute**: Place QR codes at event booths
3. **Monitor**: Check `/admin/events` for signup analytics
4. **Follow Up**: Engage designers who completed signup

The system is designed to be "set and forget" for events while providing comprehensive analytics and a seamless designer experience. 