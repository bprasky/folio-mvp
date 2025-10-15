# 🚀 Material Bank Importer - Quick Reference

## ⚡ TL;DR

```bash
# 1. Setup (one-time)
cp env.example .env.local
# Edit .env.local with your credentials

# 2. Run import
tsx .cursor/tools/run-import.ts https://materialbank.com/board/YOUR-BOARD-ID

# 3. Check results
ls exports/
cat exports/import-report-*.json
```

---

## 🔑 Required Environment Variables

```env
MB_EMAIL=your@email.com
MB_PASSWORD=your_password
BROWSERLESS_API_KEY=get_from_browserless.io
FOLIO_BASE=https://app.folioad.com
FOLIO_API_KEY=optional_api_key
```

---

## 📝 Common Commands

### Run import
```bash
tsx .cursor/tools/run-import.ts <board-url>
```

### Check latest report
```bash
cat exports/import-report-$(ls exports/import-report-*.json | tail -1 | xargs basename)
```

### View all imports
```bash
ls -lah exports/
```

### Clean up exports folder
```bash
rm exports/*.csv exports/*.json
```

---

## 🎯 Cursor AI Agent

**Open Cursor → Tasks → "Material Bank Board Importer"**

Just paste your board URL when prompted!

---

## 🔧 Quick Fixes

### Login fails
1. Check credentials in `.env.local`
2. Verify at materialbank.com
3. Try new password

### No products created
1. Check `FOLIO_API_KEY` permissions
2. Test API endpoint manually
3. Review error in report JSON

### CSV not downloaded
1. Verify board URL is accessible
2. Check Browserless quota at browserless.io
3. Increase timeout in `materialbank.ts`

---

## 📊 Output Files

```
exports/
├── materialbank-1697234567890.csv     # Downloaded CSV
└── import-report-1697234567890.json   # Import results
```

---

## 🛠️ File Locations

```
.cursor/
├── tasks/materialbank-board-importer.task.md  ← Cursor AI agent
└── tools/
    ├── materialbank.ts                        ← Login & export
    ├── normalize-to-folio.ts                  ← Parser & uploader
    └── run-import.ts                          ← CLI entry point

README-MATERIALBANK-IMPORTER.md                ← Full docs
MATERIALBANK_SETUP_COMPLETE.md                 ← Setup guide
```

---

**Full docs**: [README-MATERIALBANK-IMPORTER.md](../README-MATERIALBANK-IMPORTER.md)

