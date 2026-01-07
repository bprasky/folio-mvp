# Folio MVP - Interior Design Platform

<!-- Build trigger: Force new deployment with TypeScript fixes -->

A comprehensive platform connecting homeowners, designers, and vendors in the interior design ecosystem.

## 🎯 Features

### For Homeowners
- **Discover Inspiration**: Browse curated design posts and trends
- **Find Professionals**: Connect with verified interior designers
- **Shop Products**: Access vendor catalogs with designer recommendations
- **Project Management**: Track design projects and collaborate with professionals

### For Designers
- **Portfolio Showcase**: Display projects and build professional presence
- **Client Management**: Tools for project collaboration and communication
- **Product Discovery**: Access to vendor catalogs and product specifications
- **Analytics Dashboard**: Track engagement and project metrics
- **Jobs Marketplace**: Smart matching system for homeowner projects with lead preferences and project matching engine

### For Vendors
- **Product Catalog**: Showcase products to designers and homeowners
- **Analytics Dashboard**: Track product performance and designer engagement
- **Event Management**: Promote products through design events
- **Designer Outreach**: Connect with designers who save/view products
- **🆕 Smart Product Uploader**: Paste any product URL to automatically extract and populate product information

### For Students
- **Explore Feed**: Discover design inspiration, tutorials, and industry insights
- **Muscle Classes**: Learn through real project case studies and tutorials
- **Mentorship Portal**: Connect with industry professionals for guidance
- **Portfolio Builder**: Showcase work and receive feedback from professionals

## 🚀 Recent Updates

### Smart Product Uploader (NEW!)
Vendors can now add products effortlessly:
1. **Paste URL**: Simply paste any product URL from major retailers
2. **Auto-Extract**: System automatically pulls product name, price, images, description, and specifications
3. **Edit & Review**: Fine-tune details before publishing
4. **One-Click Add**: Product is instantly added to your catalog

**Supported Sites**: West Elm, CB2, Wayfair, IKEA, Target, Amazon, and more

### Jobs Marketplace for Designers
- Lead preferences diagnostic quiz
- Smart project matching (0-100% compatibility scores)
- Pre-drafted message templates for homeowner outreach
- Budget and location filtering

### Student Ecosystem
- Complete learning platform with tutorials and mentorship
- Real-world project case studies
- Professional development tools
- Industry networking opportunities

## 🛠 Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Authentication**: Next.js middleware with cookie-based sessions
- **Deployment**: Vercel with password protection
- **Data**: JSON-based mock data (ready for database integration)

## 🎮 Demo Flow

### Vendor Product Upload Demo
1. Navigate to `/vendor` (select Vendor role first)
2. Click "Add Product" button
3. Paste any product URL (try: `https://www.westelm.com/products/harmony-sofa/`)
4. Watch as product data is automatically extracted
5. Edit details as needed and submit

### Designer Jobs Demo
1. Select Designer role from the role selector (Profile navigation will automatically link to role-specific pages)
2. Navigate to Jobs tab in sidebar
3. Complete lead preferences quiz
4. Browse matched homeowner projects
5. View compatibility scores and project details

### Student Learning Demo
1. Select Student role
2. Explore all 4 tabs: Explore, Classes, Mentorship, Portfolio
3. Interact with tutorials, mentor profiles, and portfolio tools

## 🔐 Authentication

The site is password-protected with a beautiful coming soon page:
- **Password**: `folio2024`
- **Session**: 24-hour duration
- **Access**: `/auth` for login page

## 📁 Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── vendor/            # Vendor dashboard and product management
│   ├── jobs/              # Designer jobs marketplace
│   ├── student/           # Student learning platform
│   └── auth/              # Authentication pages
├── components/            # Reusable React components
│   ├── vendor/            # Vendor-specific components
│   │   └── ProductUploader.tsx  # Smart URL-based product uploader
│   ├── inspire/           # Content discovery components
│   └── ...
├── data/                  # Mock data and JSON files
└── middleware.ts          # Authentication middleware
```

## 🌟 Key Innovations

1. **Smart URL Parsing**: Automatically extract product data from any retailer URL
2. **Role-Based Experience**: Completely different interfaces for each user type
3. **AI-Powered Matching**: Intelligent project-designer compatibility scoring
4. **Real-Time Collaboration**: Student-mentor and designer-client interactions
5. **Cross-Platform Integration**: Seamless connections between all user types

## 🚀 Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Visit `http://localhost:3000`
5. Enter password: `folio2024`
6. Select your role and explore!

## 🔄 Development Workflow

- **Multi-workstation ready**: Full Git version control
- **Hot reload**: Instant updates during development
- **TypeScript**: Full type safety and IntelliSense
- **Responsive**: Mobile-first design approach

---

**Live Demo**: [Your Vercel URL]
**Repository**: https://github.com/bprasky/folio-mvp

Built with ❤️ for the interior design community 