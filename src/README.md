# Folio MVP

A comprehensive design platform connecting homeowners, designers, and vendors with AI-powered project matching and portfolio management.

## ✨ Features

### 🏠 For Homeowners
- **AI-Guided Project Creation** - 6-step onboarding process for design projects
- **Basic Folder Management** - Save and organize design inspiration
- **Upgrade Path** - Convert basic folders to AI-assisted projects after 5+ saves
- **Project Dashboard** - Track progress and manage multiple projects

### 🎨 For Designers  
- **Jobs Marketplace** - Find homeowner projects that match your expertise
- **Lead Preferences Quiz** - Set your ideal project criteria (budget, type, style, etc.)
- **Smart Matching Engine** - Get scored project matches (0-100%) based on your preferences
- **Portfolio Management** - Showcase your work and expertise
- **Direct Messaging** - Connect with potential clients

### 🏪 For Vendors
- **Product Analytics** - Track saves, engagement, and performance metrics
- **Event Participation** - Showcase products at design events
- **Designer Engagement** - See which designers interact with your products

### 🌟 Platform Features
- **Role-Based Navigation** - Dynamic UI based on user type
- **Global Role Selector** - Switch between homeowner/designer/vendor views
- **Event Management** - Create and participate in design events
- **Community Features** - Connect with other platform users
- **Mobile-Responsive Design** - Works seamlessly across all devices

## 🚀 Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: React Icons (Font Awesome)
- **State Management**: React Context API
- **Data**: Mock JSON files for demo

## 🏃‍♂️ Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - Use the role selector (top-right) to switch between user types
   - Explore different features based on your selected role

## 📁 Project Structure

```
/
├── app/                    # Next.js 13+ app directory
│   ├── jobs/              # Designer job matching
│   ├── homeowner-demo/    # Homeowner project creation demo
│   ├── designer/          # Designer portfolio pages
│   ├── vendor/            # Vendor analytics and management
│   └── ...
├── components/            # Reusable UI components
│   ├── AIOnboardingFlow.tsx    # 6-step project setup
│   ├── ProjectDashboard.tsx    # Project management
│   ├── LeadPreferencesCard.tsx # Designer preferences
│   ├── ProjectMatchingEngine.tsx # Job matching logic
│   └── ...
├── contexts/              # React Context providers
├── data/                  # Mock JSON data
├── public/               # Static assets
└── styles/               # Global styles
```

## 🎯 Key Demo Flows

### Homeowner Flow
1. Select "Homeowner" role
2. Visit `/homeowner-demo`
3. Click "+Design" to create a project
4. Choose AI-guided setup
5. Complete 6-step onboarding
6. View project dashboard

### Designer Flow
1. Select "Designer" role  
2. Visit `/jobs` from sidebar
3. Complete lead preferences quiz
4. Browse matched homeowner projects
5. Send messages to potential clients

### Vendor Flow
1. Select "Vendor" role
2. Visit `/vendor/dashboard`
3. View product analytics
4. Track designer engagement
5. Manage event participation

## 🛠 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production  
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 📊 Mock Data

The application includes realistic mock data for:
- **Homeowner Projects** - AI-guided and basic folder projects
- **Designer Profiles** - Portfolios, preferences, and expertise
- **Product Catalog** - Furniture, lighting, and decor items
- **Events** - Design shows, product launches, and workshops
- **Analytics** - Engagement metrics and performance data

## 🔄 Recent Updates

- ✅ Added Jobs marketplace for designers
- ✅ Implemented AI-guided homeowner onboarding
- ✅ Built project matching algorithm (0-100% scoring)
- ✅ Created role-based navigation system
- ✅ Added upgrade path from basic to AI projects
- ✅ Implemented comprehensive project dashboard

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is for demonstration purposes.

---

**Built with ❤️ for the design community** 