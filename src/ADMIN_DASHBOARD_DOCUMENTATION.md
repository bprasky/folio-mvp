# Admin User Management Dashboard

## Overview

The Admin User Management Dashboard provides comprehensive monitoring and management capabilities for user accounts, import status, and system health. This dashboard helps administrators track the success of the enhanced designer signup system and identify issues with website scraping and portfolio imports.

## Features

### 📊 Real-time Analytics
- **User Statistics**: Total users, active users, pending onboarding
- **Import Success Rate**: Percentage of successful portfolio imports
- **Event Attribution**: Track signups by specific events
- **Recent Activity**: Monitor new signups and user engagement

### 🔍 Import Status Monitoring
- **Success/Failure Tracking**: Monitor website scraping attempts
- **Error Reporting**: Detailed error messages for failed imports
- **Retry Functionality**: Manually retry failed imports
- **Import History**: Track all import attempts with timestamps

### 👥 User Management
- **User Profiles**: View and manage all user accounts
- **Status Filtering**: Filter by user status (active, inactive, pending)
- **Profile Type Filtering**: Filter by user type (designer, vendor, etc.)
- **Search Functionality**: Search users by name, email, or website

### 📈 Reporting & Export
- **Data Export**: Export user data and import status to CSV
- **Filtered Exports**: Export only filtered/specific data
- **Real-time Updates**: Dashboard refreshes automatically

## Access

### URL
```
http://localhost:3000/admin/user-management
```

### Navigation
1. Go to the main admin dashboard: `/admin`
2. Click the "User Management" button in the header
3. Or navigate directly to `/admin/user-management`

## Dashboard Components

### Stats Cards
- **Total Users**: Count of all registered users
- **Active Users**: Users who have completed onboarding and are active
- **Pending Onboarding**: Users who haven't completed the signup process
- **Import Success Rate**: Percentage of successful website scraping attempts

### Filters
- **Status Filter**: All, Active, Inactive, Pending
- **Profile Type Filter**: All Types, Designer, Vendor, Homeowner, Student
- **Import Status Filter**: All Imports, Success, Partial, Failed, Pending
- **Search**: Search by user name, email, or website URL

### Import Status Table
Columns:
- **User**: Email and user ID
- **Website**: Clickable website URL
- **Status**: Success, Partial, Failed, or Pending
- **Error Message**: Detailed error information for failed imports
- **Import Date**: When the import was attempted
- **Retries**: Number of retry attempts
- **Actions**: Retry button for failed imports

## API Endpoints

### Get All Users
```
GET /api/admin/users
```
Returns all users with their import status and onboarding information.

### Get Import Status
```
GET /api/admin/import-status
```
Returns detailed import status for all users.

### Retry Import
```
POST /api/admin/retry-import/[userId]
```
Retries a failed import for a specific user.

## Current Issues Identified

Based on the logs and dashboard data, the following issues have been identified:

### 1. Browserless Endpoint Deprecated
**Error**: `This URL is a legacy endpoint, please use https://production-sfo.browserless.io`
**Impact**: Website scraping is failing for all users
**Solution**: Update the scraping service to use the new endpoint

### 2. Database Schema Issues
**Error**: `column "event_id" of relation "website_scrapes" does not exist`
**Impact**: Import tracking is not working properly
**Solution**: Update database schema to include missing fields

### 3. Partial Import Success
**Issue**: Some imports succeed but with incomplete data
**Impact**: Users get partial portfolio imports
**Solution**: Improve error handling and retry logic

## Troubleshooting

### Common Issues

#### Dashboard Not Loading
- Check if you're logged in as an admin user
- Verify the API endpoints are accessible
- Check browser console for JavaScript errors

#### Import Status Not Updating
- Refresh the dashboard manually
- Check the API response for errors
- Verify the scraping service is running

#### Retry Function Not Working
- Check if the user has a valid website URL
- Verify the scraping service configuration
- Check server logs for detailed error messages

### Debug Mode
Enable debug logging by checking the browser console and server logs for detailed error information.

## Future Enhancements

### Planned Features
- **Real-time Notifications**: WebSocket updates for import status changes
- **Bulk Operations**: Retry multiple failed imports at once
- **Advanced Filtering**: Date range filters, custom search queries
- **User Communication**: Send messages to users about import issues
- **Analytics Dashboard**: Charts and graphs for import success rates

### Technical Improvements
- **Database Optimization**: Indexing for faster queries
- **Caching**: Cache frequently accessed data
- **Rate Limiting**: Prevent abuse of retry functionality
- **Audit Logging**: Track all admin actions

## Usage Instructions

### For Administrators

1. **Monitor Daily**: Check the dashboard daily for new signups and import issues
2. **Review Failed Imports**: Look for patterns in failed imports
3. **Retry Failed Imports**: Use the retry button for failed imports
4. **Export Data**: Export data for external analysis
5. **Track Success Rates**: Monitor import success rates over time

### For Event Organizers

1. **Event Attribution**: Use the dashboard to track event-specific signups
2. **Import Quality**: Monitor the quality of portfolio imports
3. **User Support**: Identify users who need help with onboarding
4. **Success Metrics**: Track conversion rates from event to completed profiles

## Security Considerations

- **Admin Access Only**: Dashboard is restricted to admin users
- **Data Privacy**: User data is handled according to privacy policies
- **Audit Trail**: All admin actions are logged
- **Rate Limiting**: API endpoints are protected against abuse

## Support

For technical support or feature requests:
- **Documentation**: Check this file and related READMEs
- **Issues**: Report bugs through the project issue tracker
- **Enhancements**: Submit feature requests with detailed use cases

---

*This admin dashboard provides essential visibility into the user onboarding process and helps ensure the success of the enhanced designer signup system.* 