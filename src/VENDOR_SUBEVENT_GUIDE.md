# Vendor Subevent Creation Guide

## 🎯 Overview
After creating a festival as an admin, you can now switch between different vendor accounts to create subevents that require admin approval.

## 🚀 How to Test Vendor Subevent Creation

### Step 1: Create Festival (Admin)
1. **Login as Admin**
   - Go to http://localhost:3002
   - Click the profile switcher in the top navigation
   - Select "Admin" role
   - You should see the admin dashboard

2. **Create a Festival**
   - Navigate to "Events" → "Create Event"
   - Fill out the festival details:
     - Title: "NYCxDesign 2026"
     - Description: "The Premier Design Festival"
     - Start Date: Select a future date
     - End Date: Select a future date
     - Location: "New York City"
     - Type: "Festival"
   - Click "Create Event"
   - ✅ Festival created successfully!

### Step 2: Switch to Vendor Role
1. **Access Profile Switcher**
   - Click the profile switcher in the top navigation
   - Select "Vendor" role
   - You'll be redirected to the vendor dashboard

2. **Select Vendor Account**
   - The dropdown will show "Select Vendor Account" with 3 available vendors:
     - **Benjamin Moore** - Premium paint and coatings
     - **Caesarstone** - Premium quartz surfaces
     - **Flos Lighting** - Design lighting and furniture
   - Click on any vendor to activate that account

### Step 3: Create Subevents
1. **Navigate to Events**
   - In the vendor dashboard, go to "Events"
   - You should see the festival you created as admin

2. **Create Subevent**
   - Click on the festival
   - Look for "Create Subevent" or similar option
   - Fill out subevent details:
     - Title: "Product Showcase"
     - Description: "Exclusive product demonstration"
     - Start Time: Select a time during the festival
     - End Time: Select end time
     - Type: "Booth" or "Talk"
     - Visibility: "Public" or "Invite-only"
   - Submit for admin approval

### Step 4: Admin Approval Process
1. **Switch Back to Admin**
   - Use the profile switcher to return to "Admin" role
   - Navigate to the admin dashboard

2. **Review Subevents**
   - Look for pending subevent approvals
   - Review the subevent details
   - Approve or reject the subevent

## 🔄 Vendor Switching Features

### Multiple Vendor Accounts
- **3 Test Vendors Available:**
  - Benjamin Moore (contact@benjaminmoore.com)
  - Caesarstone (info@caesarstone.com)  
  - Flos Lighting (hello@flos.com)

### Profile Switcher Enhancements
- **Clear Labeling:** Shows "Select Vendor Account" instead of "Vendor Profiles"
- **Count Indicator:** Displays "(3 available)" when multiple vendors exist
- **Active Profile Highlighting:** Current vendor is highlighted in blue
- **Brand Names:** Uses company names for vendor profiles

### Seamless Switching
- Switch between vendors without losing your place
- Each vendor maintains their own subevents and products
- Admin can see all vendors and their subevents

## 🎪 Subevent Types Available
- **Booth:** Product showcase areas
- **Talk:** Educational presentations
- **Panel:** Industry discussions
- **Workshop:** Hands-on sessions
- **Networking:** Meet and greet events
- **Dinner:** Exclusive dining experiences
- **Private:** Invitation-only events

## 🔐 Visibility Controls
- **Public:** Visible to all festival attendees
- **Invite-only:** Requires specific invitations
- **Hidden:** Admin-only visibility

## 📧 Email Invites
- Vendors can send email invites to designers
- Invites include direct links to create accounts
- Automatic profile scraping from designer websites

## 🧪 Testing Scenarios

### Scenario 1: Multiple Vendor Subevents
1. Switch to Benjamin Moore → Create "Paint Workshop"
2. Switch to Caesarstone → Create "Surface Demo"
3. Switch to Flos → Create "Lighting Talk"
4. Admin approves all three

### Scenario 2: Invite-Only Events
1. Create subevent with "Invite-only" visibility
2. Send email invites to designers
3. Designers receive invites and can RSVP

### Scenario 3: Admin Management
1. Admin reviews all pending subevents
2. Approves some, rejects others
3. Manages event capacity and scheduling

## ✅ Success Indicators
- ✅ Festival created by admin
- ✅ Multiple vendor accounts available
- ✅ Seamless vendor switching
- ✅ Subevent creation and submission
- ✅ Admin approval workflow
- ✅ Email invite system
- ✅ Profile scraping for designers

## 🐛 Troubleshooting

### No Vendors Showing
- Run: `node scripts/add-test-vendors.js`
- Check database connection
- Verify API endpoints

### Profile Switcher Issues
- Clear browser cache
- Restart development server
- Check console for errors

### Subevent Creation Fails
- Verify festival exists
- Check vendor permissions
- Review form validation

---

**Ready to test!** The system is now fully functional for admin festival creation and vendor subevent management with seamless role switching. 