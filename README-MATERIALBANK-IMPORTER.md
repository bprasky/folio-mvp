# Material Bank Board Importer

Automated tool for importing product data from Material Bank boards into Folio.

## 🎯 Overview

This importer uses Browserless (Puppeteer) to automate Material Bank's CSV export feature, then normalizes and uploads products into your Folio platform via the REST API.

## 📋 Prerequisites

1. **Material Bank Account** with access to boards
2. **Browserless.io API Key** (free tier available at https://browserless.io)
3. **Folio Instance** running with API access
4. **Node.js 18+** and npm installed

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install puppeteer-core papaparse dotenv
npm install --save-dev @types/papaparse
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
MB_EMAIL=bp@folioad.com
MB_PASSWORD=your_new_secure_password
BROWSERLESS_API_KEY=your_browserless_key_here
FOLIO_BASE=https://app.folioad.com
FOLIO_API_KEY=your_folio_api_key_here
```

**🔒 Security Notes:**
- Never commit `.env.local` to version control
- Rotate your Material Bank password regularly
- Use a dedicated API key for imports (not your personal admin key)

### 3. Run the Importer

**Via Cursor AI Agent** (Recommended):
1. Open Cursor
2. Go to **Tasks** → **Material Bank Board Importer**
3. Paste your Material Bank board URL when prompted
4. The agent will handle the rest!

**Via Command Line**:

```bash
tsx .cursor/tools/run-import.ts https://materialbank.com/board/your-board-id
```

## 📁 File Structure

```
.cursor/
├── tasks/
│   └── materialbank-board-importer.task.md  # Cursor AI agent prompt
└── tools/
    ├── materialbank.ts                      # Puppeteer automation
    ├── normalize-to-folio.ts                # CSV parser & API uploader
    └── run-import.ts                        # CLI entry point

exports/                                     # Downloaded CSVs & reports
├── materialbank-*.csv
└── import-report-*.json
```

## 🔧 How It Works

### Step 1: Authentication & Export
1. Connects to Browserless headless Chrome
2. Logs into Material Bank with your credentials
3. Navigates to the specified board URL
4. Clicks "Customize Export" → "Export CSV"
5. Downloads the CSV file

### Step 2: Normalization
Parses CSV rows and maps Material Bank fields to Folio schema:

| Material Bank Field | Folio Field | Transformation |
|---------------------|-------------|----------------|
| Brand | Vendor | Creates/finds vendor |
| Product Name | Product.name | Direct mapping |
| Finish, Material, Color, Dimensions | Product.description | Concatenated with " • " |
| Finish, Material, Color | Product.tags | Array of lowercase tags |
| Image URL | Product.images | Array with single URL |
| URL | Product.sourceRefs | `{source: "materialbank", url}` |
| SKU | Product.sku | Direct mapping |

### Step 3: Upload
1. For each unique brand, creates or finds the vendor in Folio
2. For each product, calls `POST /api/products` with normalized payload
3. Tracks created/updated/skipped counts
4. Generates final report

## 📊 Output

### Console Output
```
🚀 Material Bank Board Importer
================================

🔍 Validating environment variables...
✅ Environment validated

📥 Step 1: Exporting board from Material Bank...
🔐 Connecting to Browserless...
🌐 Navigating to Material Bank login...
📝 Entering credentials...
✅ Logged in to Material Bank
📋 Opening board: https://materialbank.com/board/abc123
📦 CSV downloaded: ./exports/materialbank-1697234567890.csv (137 products)
✅ Export complete: 137 products

📤 Step 2: Uploading products to Folio...
➕ Creating vendor: Stone Source
✅ Row 1: Created "Travertine Beige Honed"
✅ Row 2: Created "Taj Mahal Quartzite"
...
✅ Upload complete

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
| Travertine Beige Honed | ✅ Created | /product/tra-bei-hon |
| Taj Mahal Quartzite | ✅ Created | /product/taj-mah-qua |
| Botticino Marble | ✅ Created | /product/bot-mar |
| Calacatta Gold | ✅ Created | /product/cal-gol |
| Nero Marquina | ✅ Created | /product/ner-mar |

---

✨ Import completed successfully!
```

### JSON Report
Saved to `./exports/import-report-*.json`:

```json
{
  "vendor": "Stone Source",
  "vendorId": "abc123-def456-ghi789",
  "productsCreated": 135,
  "productsUpdated": 2,
  "productsSkipped": 0,
  "errors": [],
  "timestamp": "2025-10-13T19:30:45.123Z",
  "csvPath": "./exports/materialbank-1697234567890.csv",
  "sampleProducts": [
    {
      "name": "Travertine Beige Honed",
      "status": "✅ Created",
      "url": "/product/tra-bei-hon"
    }
  ]
}
```

## 🛠️ Troubleshooting

### "Missing required environment variables"
- Ensure `.env.local` exists and contains all required variables
- Check for typos in variable names
- Try running with `dotenv` explicitly: `tsx -r dotenv/config .cursor/tools/run-import.ts`

### "Login failed" or "Cannot find email input"
- Material Bank may have changed their login page structure
- Update the selectors in `.cursor/tools/materialbank.ts`
- Check if Material Bank requires 2FA (not currently supported)

### "No CSV file was downloaded"
- Check if the board URL is correct and accessible
- Material Bank may have rate limits or security measures
- Try increasing the wait time in `exportBoardCSV()`

### "Failed to create vendor/product"
- Verify your `FOLIO_API_KEY` has write permissions
- Check that your Folio API endpoints match the expected format
- Review API error messages in the console output

## 🔐 Security Best Practices

1. **Credentials**
   - Use a dedicated Material Bank account for imports
   - Store credentials only in `.env.local` (never in code)
   - Add `.env.local` to `.gitignore`

2. **API Keys**
   - Use scoped API keys with minimal required permissions
   - Rotate keys regularly
   - Monitor API usage for anomalies

3. **Browserless**
   - Use a dedicated API key per project
   - Monitor usage to avoid unexpected charges
   - Consider self-hosted Browserless for sensitive data

## 📝 Customization

### Custom Field Mapping

Edit `.cursor/tools/normalize-to-folio.ts` → `normalizeProduct()`:

```typescript
function normalizeProduct(row: CSVRow, vendorId: string): ProductPayload | null {
  // Add custom fields
  const customField = row['Custom Field']
  
  return {
    vendorId,
    name: row['Product Name'],
    // ... your custom mapping
  }
}
```

### Additional Validation

Add validation logic before upload:

```typescript
// In normalizeAndUpload()
if (!payload.images.length) {
  console.log(`⚠️  Row ${i}: Skipped (no image)`)
  report.productsSkipped++
  continue
}
```

## 🎨 Cursor AI Agent Usage

The included Cursor AI agent task (`.cursor/tasks/materialbank-board-importer.task.md`) provides an interactive import experience:

1. Open Cursor IDE
2. Press `Cmd/Ctrl + Shift + P` → "Run Task"
3. Select "Material Bank Board Importer"
4. Paste your board URL when prompted
5. The agent will:
   - Validate your environment
   - Export the CSV
   - Parse and normalize products
   - Upload to Folio
   - Show a beautiful summary table

## 📦 Package Dependencies

Add to your `package.json`:

```json
{
  "dependencies": {
    "puppeteer-core": "^21.0.0",
    "papaparse": "^5.4.1",
    "dotenv": "^17.2.0"
  },
  "devDependencies": {
    "@types/papaparse": "^5.3.14"
  }
}
```

## 🤝 Contributing

Found a bug or have a feature request? Open an issue or submit a PR!

## 📄 License

MIT - Use freely, but please keep Material Bank's Terms of Service in mind when automating their platform.

---

**Questions?** Contact the Folio team or check the main [FOLIO_HANDOFF_README.md](./FOLIO_HANDOFF_README.md)

