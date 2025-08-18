# 🔐 Authentication Debug & Testing Guide

This guide explains how to use the new authentication debugging endpoints to verify sign-out functionality and troubleshoot authentication issues.

## 🚀 Quick Start

### 1. Test All Endpoints
```bash
npm run test:auth
```

### 2. Manual Testing
```bash
# Check current session
curl http://localhost:3000/api/debug/whoami

# Force logout (clear all cookies)
curl -X POST http://localhost:3000/api/auth/force-logout

# Check session after logout
curl http://localhost:3000/api/debug/whoami
```

## 📋 Available Endpoints

### 🔍 Debug Session: `/api/debug/whoami`
**GET** - Shows current authentication state

**Response:**
```json
{
  "cookiesPresent": ["next-auth.session-token"],
  "session": {
    "email": "Vendor@folio.com",
    "role": "VENDOR"
  },
  "timestamp": "2025-08-07T..."
}
```

**Use case:** Verify if user is signed in and what cookies exist

---

### 🧹 Force Logout: `/api/auth/force-logout`
**POST** - Clears all NextAuth cookies immediately

**Response:**
```json
{
  "ok": true,
  "cleared": [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.csrf-token",
    "next-auth.callback-url"
  ],
  "message": "All NextAuth cookies cleared"
}
```

**Use case:** Force clear authentication state when normal sign-out fails

---

### ⬆️ Elevate Role: `/api/maintenance/elevate-role`
**POST** - Change user role (development only)

**Headers:**
```
x-maintenance-token: your_token_here
```

**Body:**
```json
{
  "email": "Vendor@folio.com",
  "role": "ADMIN"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "Vendor@folio.com",
    "role": "ADMIN",
    "name": "BRADLEY PRASKY"
  },
  "message": "Role elevated to ADMIN for Vendor@folio.com"
}
```

**Use case:** Give yourself admin privileges for testing

---

## 🧪 Testing Sign-Out Process

### Step 1: Check Initial State
```bash
curl http://localhost:3000/api/debug/whoami
```
Should show you're signed in with VENDOR role.

### Step 2: Sign Out from UI
1. Go to your app
2. Click profile dropdown
3. Click "Sign Out"
4. Watch terminal for debug logs

### Step 3: Verify Sign-Out
```bash
curl http://localhost:3000/api/debug/whoami
```
Should show:
- `cookiesPresent: []` (no cookies)
- `session: null` (no session)

### Step 4: Force Logout (if needed)
If normal sign-out didn't work:
```bash
curl -X POST http://localhost:3000/api/auth/force-logout
```

## 🔧 Troubleshooting

### Issue: Session persists after sign-out
**Solution:** Use force-logout endpoint to clear all cookies

### Issue: Can't access admin features
**Solution:** Use elevate-role endpoint to give yourself ADMIN role

### Issue: Cookies not clearing
**Check:**
1. Browser developer tools → Application → Cookies
2. Look for any `next-auth*` cookies
3. Use force-logout endpoint

## 🛡️ Security Notes

- **Force logout** and **elevate role** only work in development
- **Elevate role** requires `MAINTENANCE_TOKEN` environment variable
- All endpoints use the same Prisma singleton as your app
- No additional database connections are created

## 🔄 Environment Setup

### Set Maintenance Token
```bash
# PowerShell
$env:MAINTENANCE_TOKEN="abc123"

# Bash/Zsh
export MAINTENANCE_TOKEN=abc123
```

### Verify Prisma Singleton
The app now uses a single Prisma client instance:
- `src/lib/prisma.ts` - Singleton definition
- All auth routes import from this file
- No more `new PrismaClient()` calls

## 📱 Browser Testing

1. **Open Dev Tools** → Application → Cookies
2. **Sign in** - Should see `next-auth.session-token`
3. **Sign out** - Cookie should disappear
4. **Check debug endpoint** - Should show `session: null`

## 🎯 Expected Behavior

### Before Sign-Out:
- ✅ User shows as signed in
- ✅ Profile dropdown shows user info
- ✅ Protected routes accessible
- ✅ Debug endpoint shows session data

### After Sign-Out:
- ✅ User redirected to sign-in page
- ✅ Profile dropdown hidden
- ✅ Protected routes redirect to sign-in
- ✅ Debug endpoint shows `session: null`
- ✅ No NextAuth cookies present

## 🚨 Common Issues

### "Session still shows after sign-out"
- Check if you're using the right port (3000, 3001, or 3002)
- Try force-logout endpoint
- Clear browser cookies manually

### "Can't access admin features"
- Use elevate-role endpoint to become ADMIN
- Check if role was updated in database
- Sign out and sign back in

### "Cookies not clearing"
- Use force-logout endpoint
- Check browser dev tools for cookie state
- Verify NextAuth configuration

## 📞 Support

If you encounter issues:
1. Check the debug endpoint first
2. Use force-logout if normal sign-out fails
3. Check terminal logs for NextAuth debug info
4. Verify environment variables are set correctly

---

**Happy debugging! 🐛✨** 