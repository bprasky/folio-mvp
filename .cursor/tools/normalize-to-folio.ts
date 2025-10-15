/**
 * Material Bank to Folio Normalization & Upload
 * 
 * Parses exported Material Bank CSV files and uploads products to Folio
 * via the REST API.
 * 
 * Required environment variables:
 * - FOLIO_BASE: Base URL for Folio API (e.g., https://app.folioad.com)
 * - FOLIO_API_KEY: API key for authentication (optional, may use session auth)
 */

import fs from 'fs/promises'
import Papa from 'papaparse'

interface CSVRow {
  Brand?: string
  'Product Name'?: string
  SKU?: string
  Finish?: string
  Material?: string
  Color?: string
  Dimensions?: string
  URL?: string
  'Image URL'?: string
  [key: string]: string | undefined
}

interface Vendor {
  id: string
  name: string
  website?: string
}

interface ProductPayload {
  vendorId: string
  name: string
  description: string
  sku?: string
  price?: number | null
  images: Array<{ url: string }>
  sourceRefs: Array<{ source: string; url: string }>
  tags: string[]
}

interface ImportReport {
  vendor: string
  vendorId: string
  productsCreated: number
  productsUpdated: number
  productsSkipped: number
  errors: Array<{ row: number; error: string }>
  timestamp: string
  csvPath: string
  sampleProducts: Array<{ name: string; status: string; url?: string }>
}

/**
 * Fetches or creates a vendor in Folio
 */
async function getOrCreateVendor(vendorName: string): Promise<Vendor> {
  const FOLIO_BASE = process.env.FOLIO_BASE || 'http://localhost:3000'
  const FOLIO_API_KEY = process.env.FOLIO_API_KEY

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  if (FOLIO_API_KEY) {
    headers['Authorization'] = `Bearer ${FOLIO_API_KEY}`
  }

  // Try to find existing vendor first
  try {
    const searchRes = await fetch(`${FOLIO_BASE}/api/vendors?search=${encodeURIComponent(vendorName)}`, {
      method: 'GET',
      headers
    })

    if (searchRes.ok) {
      const vendors = await searchRes.json()
      if (vendors.length > 0) {
        console.log(`✓ Found existing vendor: ${vendorName}`)
        return vendors[0]
      }
    }
  } catch (error) {
    console.warn('Warning: Could not search for existing vendor, will create new one')
  }

  // Create new vendor
  console.log(`➕ Creating vendor: ${vendorName}`)
  const createRes = await fetch(`${FOLIO_BASE}/api/vendors`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: vendorName,
      website: 'https://materialbank.com',
      description: `Products imported from Material Bank`
    })
  })

  if (!createRes.ok) {
    const error = await createRes.text()
    throw new Error(`Failed to create vendor: ${error}`)
  }

  const vendor = await createRes.json()
  console.log(`✅ Created vendor: ${vendorName} (${vendor.id})`)
  return vendor
}

/**
 * Creates or updates a product in Folio
 */
async function upsertProduct(payload: ProductPayload): Promise<{ id: string; created: boolean }> {
  const FOLIO_BASE = process.env.FOLIO_BASE || 'http://localhost:3000'
  const FOLIO_API_KEY = process.env.FOLIO_API_KEY

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  if (FOLIO_API_KEY) {
    headers['Authorization'] = `Bearer ${FOLIO_API_KEY}`
  }

  const response = await fetch(`${FOLIO_BASE}/api/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to upsert product: ${error}`)
  }

  const result = await response.json()
  return { id: result.id, created: result.created !== false }
}

/**
 * Normalizes a CSV row into a Folio product payload
 */
function normalizeProduct(row: CSVRow, vendorId: string): ProductPayload | null {
  const name = row['Product Name']?.trim()
  
  if (!name) {
    return null
  }

  // Build description from available fields
  const descParts = [
    row['Finish'],
    row['Material'],
    row['Color'],
    row['Dimensions']
  ].filter(Boolean)
  
  const description = descParts.join(' • ')

  // Extract tags
  const tags = [
    row['Finish'],
    row['Material'],
    row['Color']
  ].filter(Boolean).map(t => t!.toLowerCase())

  // Build images array
  const images = row['Image URL'] ? [{ url: row['Image URL'] }] : []

  // Build source references
  const sourceRefs = row['URL'] ? [{ source: 'materialbank', url: row['URL'] }] : []

  return {
    vendorId,
    name,
    description,
    sku: row['SKU'],
    price: null,
    images,
    sourceRefs,
    tags
  }
}

/**
 * Main import function
 * Parses CSV and uploads all products to Folio
 */
export async function normalizeAndUpload(csvPath: string): Promise<ImportReport> {
  console.log(`\n📊 Processing: ${csvPath}`)
  
  const csvContent = await fs.readFile(csvPath, 'utf-8')
  const { data } = Papa.parse<CSVRow>(csvContent, { header: true })

  console.log(`📝 Found ${data.length} rows in CSV`)

  const vendorMap = new Map<string, string>()
  const report: ImportReport = {
    vendor: '',
    vendorId: '',
    productsCreated: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    errors: [],
    timestamp: new Date().toISOString(),
    csvPath,
    sampleProducts: []
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    
    try {
      // Get or create vendor
      const vendorName = row['Brand']?.trim() || 'Unknown Vendor'
      
      let vendorId = vendorMap.get(vendorName)
      if (!vendorId) {
        const vendor = await getOrCreateVendor(vendorName)
        vendorId = vendor.id
        vendorMap.set(vendorName, vendorId)
        
        // Set report vendor info from first vendor
        if (!report.vendorId) {
          report.vendor = vendorName
          report.vendorId = vendorId
        }
      }

      // Normalize product
      const payload = normalizeProduct(row, vendorId)
      
      if (!payload) {
        console.log(`⚠️  Row ${i + 1}: Skipped (missing product name)`)
        report.productsSkipped++
        continue
      }

      // Upload product
      const result = await upsertProduct(payload)
      
      if (result.created) {
        console.log(`✅ Row ${i + 1}: Created "${payload.name}"`)
        report.productsCreated++
      } else {
        console.log(`🔄 Row ${i + 1}: Updated "${payload.name}"`)
        report.productsUpdated++
      }

      // Add to sample products (first 5)
      if (report.sampleProducts.length < 5) {
        report.sampleProducts.push({
          name: payload.name,
          status: result.created ? '✅ Created' : '🔄 Updated',
          url: `/product/${result.id}`
        })
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`❌ Row ${i + 1}: ${errorMsg}`)
      report.errors.push({
        row: i + 1,
        error: errorMsg
      })
      report.productsSkipped++
    }
  }

  // Save report
  const reportPath = `./exports/import-report-${Date.now()}.json`
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n📄 Report saved: ${reportPath}`)

  return report
}

/**
 * Validates that required environment variables are set
 */
export function validateEnvironment(): void {
  if (!process.env.FOLIO_BASE) {
    throw new Error('Missing required environment variable: FOLIO_BASE')
  }
}

/**
 * Formats the import report as a markdown table
 */
export function formatReportMarkdown(report: ImportReport): string {
  let markdown = `# Material Bank Import Report\n\n`
  markdown += `## Summary\n\n`
  markdown += `- **Vendor**: ${report.vendor}\n`
  markdown += `- **Vendor ID**: ${report.vendorId}\n`
  markdown += `- **Products Created**: ${report.productsCreated}\n`
  markdown += `- **Products Updated**: ${report.productsUpdated}\n`
  markdown += `- **Products Skipped**: ${report.productsSkipped}\n`
  markdown += `- **Errors**: ${report.errors.length}\n`
  markdown += `- **Timestamp**: ${report.timestamp}\n\n`

  if (report.sampleProducts.length > 0) {
    markdown += `## Sample Products\n\n`
    markdown += `| Product | Status | URL |\n`
    markdown += `|---------|--------|-----|\n`
    report.sampleProducts.forEach(p => {
      markdown += `| ${p.name} | ${p.status} | ${p.url || 'N/A'} |\n`
    })
    markdown += `\n`
  }

  if (report.errors.length > 0) {
    markdown += `## Errors\n\n`
    report.errors.forEach(e => {
      markdown += `- **Row ${e.row}**: ${e.error}\n`
    })
    markdown += `\n`
  }

  markdown += `---\n\n`
  markdown += `Full report saved to: \`${report.csvPath}\`\n`

  return markdown
}

