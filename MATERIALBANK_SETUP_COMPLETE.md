# ✅ Material Bank Board Importer - Setup Complete

## 📦 What Was Installed

### 1. Cursor AI Agent Task
**Location**: `.cursor/tasks/materialbank-board-importer.task.md`

This is your interactive Cursor AI agent that guides you through the import process. Use it by opening Cursor's task panel and selecting "Material Bank Board Importer".

### 2. Automation Tools
**Location**: `.cursor/tools/`

- **`materialbank.ts`** - Puppeteer automation for logging into Material Bank and exporting CSV
- **`normalize-to-folio.ts`** - CSV parser and Folio API uploader with normalization logic
- **`run-import.ts`** - CLI entry point for running imports from command line
- **`package.json`** - Tool dependencies configuration

### 3. Configuration Files
- **`env.example`** - Template for environment variables (copy to `.env.local`)
- **`README-MATERIALBANK-IMPORTER.md`** - Complete documentation
- **`MATERIALBANK_SETUP_COMPLETE.md`** - This file

### 4. Dependencies Installed
```json
{
  "puppeteer-core": "^21.0.0",
  "papaparse": "^5.4.1",
  "@types/papaparse": "^5.3.14"
}
```

### 5. Directory Structure
```
.cursor/
├── tasks/
│   └── materialbank-board-importer.task.md
└── tools/
    ├── materialbank.ts
    ├── normalize-to-folio.ts
    ├── run-import.ts
    └── package.json

exports/                  # Will be created on first run
├── materialbank-*.csv    # Downloaded CSVs
└── import-report-*.json  # Import reports
```

---

## 🚀 Quick Start Guide

### Step 1: Get Your API Keys

#### A. Browserless API Key
1. Go to https://browserless.io
2. Sign up for a free account (1,000 sessions/month)
3. Copy your API key from the dashboard

#### B. Folio API Key (Optional)
If your Folio instance requires API authentication:
1. Log into your Folio admin panel
2. Navigate to Settings → API Keys
3. Create a new key with "Vendor Write" and "Product Write" permissions
4. Copy the key

### Step 2: Configure Environment Variables

Copy the example file:
```bash
cp env.example .env.local
```

Edit `.env.local` and add your credentials:
```env
# Material Bank Login
MB_EMAIL=bp@folioad.com
MB_PASSWORD=your_secure_password_here

# Browserless API (from step 1A)
BROWSERLESS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx

# Folio Configuration
FOLIO_BASE=https://app.folioad.com
# or for local dev: http://localhost:3000

# Optional: API Key (from step 1B)
FOLIO_API_KEY=your_folio_api_key_here
```

**🔒 Important**: Never commit `.env.local` to Git! It's already in `.gitignore`.

### Step 3: Run Your First Import

#### Option A: Using Cursor AI Agent (Recommended)
1. Open Cursor
2. Press `Cmd/Ctrl + Shift + P`
3. Type "Run Task"
4. Select "Material Bank Board Importer"
5. Paste your Material Bank board URL when prompted
6. Watch the magic happen! ✨

#### Option B: Using Command Line
```bash
tsx .cursor/tools/run-import.ts https://materialbank.com/board/your-board-id
```

---

## 📊 What Happens During Import

### Phase 1: Authentication & Export (30-60 seconds)
```
🔐 Connecting to Browserless...
🌐 Navigating to Material Bank login...
📝 Entering credentials...
✅ Logged in to Material Bank
📋 Opening board: https://materialbank.com/board/abc123
🔍 Looking for "Customize Export" button...
💾 Triggering CSV export...
⏳ Waiting for download...
📦 CSV downloaded: ./exports/materialbank-1697234567890.csv (137 products)
```

### Phase 2: Normalization & Upload (1-5 minutes depending on product count)
```
📊 Processing: ./exports/materialbank-1697234567890.csv
📝 Found 137 rows in CSV
➕ Creating vendor: Stone Source
✅ Row 1: Created "Travertine Beige Honed"
✅ Row 2: Created "Taj Mahal Quartzite"
✅ Row 3: Created "Botticino Marble"
...
```

### Phase 3: Report Generation
```
📊 Final Report
================

# Material Bank Import Report

## Summary
- **Vendor**: Stone Source
- **Vendor ID**: abc123-def456-ghi789
- **Products Created**: 135
- **Products Updated**: 2
- **Products Skipped**: 0
- **Errors**: 0
- **Timestamp**: 2025-10-13T19:30:45.123Z

## Sample Products
| Product | Status | URL |
|---------|--------|-----|
| Travertine Beige | ✅ Created | /product/tra-bei-hon |
| Taj Mahal Quartzite | ✅ Created | /product/taj-mah-qua |
```

---

## 🔧 Field Mapping Reference

| Material Bank CSV Column | Folio Product Field | Transformation |
|--------------------------|---------------------|----------------|
| Brand | `vendor.name` | Creates or finds vendor |
| Product Name | `product.name` | Direct mapping |
| SKU | `product.sku` | Direct mapping |
| Finish | `product.description` | Concatenated with " • " |
| Material | `product.description` | Concatenated with " • " |
| Color | `product.description` | Concatenated with " • " |
| Dimensions | `product.description` | Concatenated with " • " |
| Finish, Material, Color | `product.tags[]` | Array of lowercase strings |
| Image URL | `product.images[0].url` | Direct mapping |
| URL | `product.sourceRefs[0]` | `{source: "materialbank", url}` |

**Example Product Transformation:**

**Material Bank CSV Row:**
```csv
Brand,Product Name,SKU,Finish,Material,Color,Dimensions,URL,Image URL
Stone Source,Travertine Beige,SS-TB-001,Honed,Travertine,Beige,12x24x0.5,https://materialbank.com/p/123,https://cdn.materialbank.com/img123.jpg
```

**Folio API Payload:**
```json
{
  "vendorId": "uuid-of-stone-source",
  "name": "Travertine Beige",
  "sku": "SS-TB-001",
  "description": "Honed • Travertine • Beige • 12x24x0.5",
  "price": null,
  "images": [
    { "url": "https://cdn.materialbank.com/img123.jpg" }
  ],
  "sourceRefs": [
    { "source": "materialbank", "url": "https://materialbank.com/p/123" }
  ],
  "tags": ["honed", "travertine", "beige"]
}
```

---

## 🛠️ Troubleshooting

### "Missing required environment variables"
**Solution**: Ensure `.env.local` exists and contains all required variables:
```bash
# Check if file exists
ls -la .env.local

# Verify contents (safely)
cat .env.local | grep "MB_EMAIL\|BROWSERLESS_API_KEY\|FOLIO_BASE"
```

### "Login failed" or timeout
**Possible causes**:
- Incorrect Material Bank credentials
- Material Bank changed their login page structure
- Network/firewall blocking Browserless

**Solution**: 
1. Verify credentials by logging in manually at materialbank.com
2. Check Browserless dashboard for session logs
3. Update password and retry

### "Failed to create vendor/product"
**Possible causes**:
- Invalid or expired `FOLIO_API_KEY`
- Folio API endpoint not accessible
- Missing permissions on API key

**Solution**:
1. Test API endpoint manually:
   ```bash
   curl -X POST https://app.folioad.com/api/vendors \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{"name":"Test Vendor","website":"https://test.com"}'
   ```
2. Verify API key permissions in Folio admin
3. Check network connectivity to Folio instance

### "No CSV file was downloaded"
**Possible causes**:
- Board URL is private or requires special permissions
- Material Bank rate limiting
- Export button selector changed

**Solution**:
1. Verify board URL is accessible in your browser
2. Check if board is shared/public
3. Increase wait time in `materialbank.ts`:
   ```typescript
   await new Promise(resolve => setTimeout(resolve, 10000)) // 10 seconds
   ```

---

## 🎯 Usage Examples

### Example 1: Import Single Board
```bash
tsx .cursor/tools/run-import.ts https://materialbank.com/board/summer-collection-2024
```

### Example 2: Import Multiple Boards (bash)
```bash
# Create a list of board URLs
boards=(
  "https://materialbank.com/board/collection-1"
  "https://materialbank.com/board/collection-2"
  "https://materialbank.com/board/collection-3"
)

# Import each board
for board in "${boards[@]}"; do
  echo "Importing: $board"
  tsx .cursor/tools/run-import.ts "$board"
  sleep 5  # Wait 5 seconds between imports
done
```

### Example 3: Schedule Automated Imports (cron)
```bash
# Add to crontab: Run every Monday at 2am
0 2 * * 1 cd /path/to/folio-mvp && tsx .cursor/tools/run-import.ts "https://materialbank.com/board/weekly-updates"
```

---

## 🔐 Security Checklist

- ✅ `.env.local` is in `.gitignore`
- ✅ Never commit credentials to Git
- ✅ Use read-only Material Bank account if possible
- ✅ Rotate API keys monthly
- ✅ Monitor Browserless usage dashboard
- ✅ Review import reports for anomalies
- ✅ Use scoped API keys (not admin keys)
- ✅ Enable 2FA on Material Bank account (if supported)

---

## 📚 Additional Resources

- **Full Documentation**: [README-MATERIALBANK-IMPORTER.md](./README-MATERIALBANK-IMPORTER.md)
- **Folio API Docs**: [Your Folio instance]/docs/api
- **Browserless Docs**: https://docs.browserless.io
- **Puppeteer Docs**: https://pptr.dev

---

## 🎉 Next Steps

1. ✅ **Set up your `.env.local`** with credentials
2. ✅ **Test import** with a small board (5-10 products)
3. ✅ **Verify products** appear correctly in Folio
4. ✅ **Customize field mapping** if needed (edit `normalize-to-folio.ts`)
5. ✅ **Set up scheduled imports** for regular updates
6. ✅ **Monitor and optimize** based on import reports

---

## 💬 Support

Questions or issues? 
- Review the troubleshooting section above
- Check import reports in `./exports/import-report-*.json`
- Review Browserless session logs at https://browserless.io/dashboard

---

**Happy Importing! 🚀**

*Last Updated: October 13, 2025*

