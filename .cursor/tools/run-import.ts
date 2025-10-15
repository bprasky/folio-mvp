#!/usr/bin/env tsx
/**
 * Material Bank Board Importer - Main Entry Point
 * 
 * Usage:
 *   tsx .cursor/tools/run-import.ts <board-url>
 * 
 * Example:
 *   tsx .cursor/tools/run-import.ts https://materialbank.com/board/abc123
 */

import { exportBoardCSV, validateEnvironment as validateMBEnv } from './materialbank'
import { normalizeAndUpload, validateEnvironment as validateFolioEnv, formatReportMarkdown } from './normalize-to-folio'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local', override: false })

async function main() {
  const boardUrl = process.argv[2]

  if (!boardUrl) {
    console.error('❌ Usage: tsx .cursor/tools/run-import.ts <board-url>')
    process.exit(1)
  }

  console.log('\n🚀 Material Bank Board Importer')
  console.log('================================\n')

  try {
    // Validate environment
    console.log('🔍 Validating environment variables...')
    validateMBEnv()
    validateFolioEnv()
    console.log('✅ Environment validated\n')

    // Step 1: Export CSV from Material Bank
    console.log('📥 Step 1: Exporting board from Material Bank...')
    const { csvPath, rowCount } = await exportBoardCSV(boardUrl)
    console.log(`✅ Export complete: ${rowCount} products\n`)

    // Step 2: Normalize and upload to Folio
    console.log('📤 Step 2: Uploading products to Folio...')
    const report = await normalizeAndUpload(csvPath)
    console.log('✅ Upload complete\n')

    // Step 3: Display report
    console.log('📊 Final Report')
    console.log('================\n')
    console.log(formatReportMarkdown(report))

    // Exit with error if there were any failures
    if (report.errors.length > 0) {
      console.error(`\n⚠️  Import completed with ${report.errors.length} errors`)
      process.exit(1)
    }

    console.log('\n✨ Import completed successfully!')
    process.exit(0)

  } catch (error) {
    console.error('\n❌ Import failed:', error)
    process.exit(1)
  }
}

main()

