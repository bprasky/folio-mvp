# Folio Authentication System

## Overview
A complete authentication system has been implemented that requires users to sign up/sign in whenever the server restarts. This allows testing with different user types and account configurations.

## Features Implemented

### 🔐 Authentication Flow
- **Signup**: Multi-step process with role selection and organization options
- **Signin**: Simple email/password authentication
- **Session Management**: Cookie-based sessions that persist across page refreshes
- **Signout**: Proper session cleanup

### 👥 User Types Supported
1. **Interior Designer**
   - Personal Account: Individual designer
   - Organization Account: Design firm, architecture firm, interior design studio

2. **Vendor/Manufacturer**
   - Personal Account: Individual vendor
   - Organization Account: Vendor company, showroom, distributor, contractor

3. **Homeowner**
   - Personal Account only (no organization needed)

### 🏢 Organization System
- Automatic organization creation when users sign up for organization accounts
- Support for different organization types based on user role
- User-organization relationships with roles (OWNER, ADMIN, etc.)

### 🛡️ Route Protection
- Middleware automatically redirects unauthenticated users to signin
- Protected routes require valid session
- Public routes remain accessible without authentication

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/signin` - Authenticate user
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/signout` - Sign out user

### Organizations
- `GET /api/organizations` - List organizations
- `POST /api/organizations` - Create organization

## User Experience

### Signup Flow
1. **Role Selection**: Choose between Designer, Vendor, or Homeowner
2. **Account Type**: For Designers/Vendors, choose Personal or Organization
3. **Details**: Fill in personal info and organization details (if applicable)
4. **Completion**: Account created and redirected to signin

### Signin Flow
1. **Credentials**: Enter email and password
2. **Authentication**: Server validates credentials
3. **Session**: Session cookie set for future requests
4. **Redirect**: User redirected to appropriate dashboard based on role

### Dashboard Access
- **Vendors**: Redirected to `/vendor/create-project`
- **Designers**: Redirected to `/designer/projects`
- **Homeowners**: Redirected to home page

## Testing Instructions

### 1. Start the Server
```bash
npm run dev
```

### 2. Test Signup Flow
1. Visit `http://localhost:3000`
2. Click "Sign Up"
3. Choose a role (Designer, Vendor, or Homeowner)
4. For Designers/Vendors, choose Personal or Organization
5. Fill in details and create account

### 3. Test Signin Flow
1. Visit `http://localhost:3000/auth/signin`
2. Enter credentials from signup
3. Verify redirect to appropriate dashboard

### 4. Test Route Protection
1. Sign out
2. Try to access protected routes (e.g., `/vendor/create-project`)
3. Verify redirect to signin page

### 5. Test Different User Types
Create multiple accounts with different roles to test:
- **Vendor Personal**: Individual vendor account
- **Vendor Organization**: Company vendor account
- **Designer Personal**: Individual designer account
- **Designer Organization**: Design firm account
- **Homeowner**: Homeowner account

## Database Schema

### User Model
```prisma
model User {
  id               String      @id @default(uuid())
  email            String?     @unique
  password         String?
  name             String
  role             Role        @default(DESIGNER)
  companyName      String?
  // ... other fields
}
```

### Organization Model
```prisma
model Organization {
  id          String   @id @default(uuid())
  name        String
  type        OrgType  @default(DESIGN_FIRM)
  description String?
  // ... other fields
}
```

### OrganizationUser Model
```prisma
model OrganizationUser {
  id             String       @id @default(uuid())
  userId         String
  organizationId String
  role           OrgUserRole  @default(MEMBER)
  isActive       Boolean      @default(true)
  // ... relationships
}
```

## Security Features

### Password Security
- Passwords hashed using bcryptjs
- 12 rounds of salting for strong security

### Session Security
- HTTP-only cookies
- Secure flag in production
- SameSite protection
- 7-day expiration

### Input Validation
- Required field validation
- Email format validation
- Password confirmation matching

## Next Steps

### Immediate Testing
1. Test all user types and account configurations
2. Verify organization creation and user assignment
3. Test route protection and redirects
4. Verify session persistence across page refreshes

### Future Enhancements
1. Email verification for new accounts
2. Password reset functionality
3. Two-factor authentication
4. Organization invitation system
5. Role-based permissions within organizations
6. Account verification for organizations

## Quick Test Commands

### Create Test Data
```bash
curl -X POST http://localhost:3000/api/test-db \
  -H "Content-Type: application/json" \
  -d '{"action": "create-test-data"}'
```

### Test Database Connection
```bash
curl http://localhost:3000/api/test-db
```

## Notes
- Sessions are cleared on server restart (as requested)
- All users can create any type of account (no verification restrictions)
- Organization types are role-specific and appropriate
- The system is ready for Monday testing with real users 