# Database Safety Guidelines

## 🚫 NEVER RUN THESE COMMANDS

- `npx prisma migrate reset` - **DESTROYS ALL DATA**
- `npx prisma db push --force-reset` - **DESTROYS ALL DATA**
- Any command that drops tables or columns

## ✅ SAFE MIGRATION WORKFLOW

### Local Development
1. **Review before applying:** `npm run migrate:create-only`
   - Check generated SQL in `prisma/migrations/*/migration.sql`
   - Ensure NO `DROP TABLE`, `DROP COLUMN`, or `ALTER TABLE ... DROP`
2. **Apply locally:** `npm run migrate:safe` (guard + backup first)

### Production/CI
- **Deploy:** `npm run migrate:deploy` (guard runs; aborts on destructive diff)

## 🔒 ENVIRONMENT SEPARATION

**CRITICAL:** Keep these separate:
- `DATABASE_URL` (development)
- `PROD_DATABASE_URL` (production) 
- `SHADOW_DATABASE_URL` (shadow for migrations)

**NEVER** point dev and prod at the same database.

## 🛡️ SAFETY CHECKS

- Run `npm run db:guard` before any migration
- Run `npm run db:backup` before applying changes
- Use `npm run check-env` to verify environment separation

## 📋 MIGRATION REVIEW CHECKLIST

Before applying any migration:
- [ ] No `DROP TABLE` statements
- [ ] No `DROP COLUMN` statements  
- [ ] No `ALTER TABLE ... DROP` statements
- [ ] Environment variables are properly separated
- [ ] Backup has been created

## 🆘 IF YOU ACCIDENTALLY DROP DATA

1. **STOP** - Don't run more commands
2. **Check backups** - Look in `backups/` directory
3. **Contact team lead** immediately
4. **Document** what happened for future prevention

## 🔧 SAFE SEEDING

Use `npm run seed:min` for idempotent seeding that won't overwrite existing data.

---

**Remember: It's better to be safe than sorry. When in doubt, ask for help.**








