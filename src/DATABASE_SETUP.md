# Database Setup Guide

## 🎯 Problem Solved

Your Folio MVP was using JSON files for data storage, which meant **every time I made code changes, your carefully curated content would reset to dummy data**. This was incredibly frustrating when you were building real content on the site!

## ✅ Solution: PostgreSQL Database

I've updated your application to use a **PostgreSQL database with Prisma ORM**. This means:

- ✅ **Data persists across code changes**
- ✅ **No more losing your work when I update the codebase**
- ✅ **Professional, scalable data storage**
- ✅ **All your existing data can be migrated safely**

## 🚀 Quick Setup

### Option 1: Use a Free Cloud Database (Recommended)

**Supabase (Easiest)**
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings → Database → Connection string
4. Copy the connection string
5. Create a `.env` file in your project root:
   ```
   DATABASE_URL="postgresql://postgres:ds%-t$#eT9$M76Z@db.gwdkhgejsyvynqzolyau.supabase.co:5432/postgres"
   NEXT_PUBLIC_SUPABASE_URL="https://gwdkhgejsyvynqzolyau.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_ANON_KEY_HERE"
   SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY_HERE"
   SUPABASE_DB_WEBHOOK_SECRET="your-webhook-secret-here"
   ```

**Other Free Options:**
- [Neon.tech](https://neon.tech) - Serverless PostgreSQL
- [Railway.app](https://railway.app) - Full-stack hosting
- [Aiven](https://aiven.io) - 1-month free trial

### Option 2: Local PostgreSQL

If you prefer local development:

1. Install PostgreSQL locally
2. Create a database: `createdb folio_mvp`
3. Set your `.env` file:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/folio_mvp"
   ```

## 📊 Migrate Your Existing Data

Once you have your database URL set up:

```bash
# Run the complete setup (recommended)
npm run setup-db

# Or run steps individually:
npx prisma db push          # Create tables
npx prisma generate         # Generate client
npm run migrate-data        # Transfer your JSON data
```

## 🔄 What Gets Migrated

The migration script will transfer ALL your existing data:

- ✅ **Projects** (with images, tags, and product links)
- ✅ **Designers** (profiles, metrics, portfolios)
- ✅ **Products** (including pending products from tagging)
- ✅ **Homeowners** (profiles and preferences)
- ✅ **Folders** (saved collections)
- ✅ **Product Tags** (all your click-to-tag work)

## 🎉 After Setup

Once the database is set up:

1. **Your data is safe** - No more resets when code changes
2. **Edit content freely** - All changes persist in the database
3. **Scalable** - Ready for production deployment
4. **Backed up** - Cloud providers handle backups automatically

## 🔧 API Updates

I've already updated these APIs to use the database:

- `/api/projects` - Now uses Prisma
- `/api/admin/designers` - Now uses Prisma
- More APIs will be updated as needed

## 🆘 Troubleshooting

**Connection Issues:**
- Verify DATABASE_URL is correct
- Check if database server is running
- Ensure firewall allows connections

**Migration Issues:**
- Check that JSON files exist in `data/` folder
- Verify database is empty before first migration
- Run `npx prisma studio` to view database contents

## 📞 Need Help?

If you run into any issues:
1. Check the terminal output for specific error messages
2. Verify your DATABASE_URL format
3. Try running each step individually
4. Let me know what error you're seeing!

---

**The bottom line:** Once this is set up, you can create and edit content on your site without worrying about losing it when I make code improvements. Your work will persist! 🎉 