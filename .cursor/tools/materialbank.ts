/**
 * Material Bank Board Automation
 * 
 * This tool handles secure authentication and CSV export from Material Bank
 * using Browserless (Puppeteer) automation.
 * 
 * Required environment variables:
 * - MB_EMAIL: Material Bank account email
 * - MB_PASSWORD: Material Bank account password
 * - BROWSERLESS_API_KEY: Browserless.io API key
 */

import puppeteer from 'puppeteer-core'
import fs from 'fs/promises'
import path from 'path'

interface LoginResult {
  browser: any
  page: any
}

interface ExportResult {
  csvPath: string
  rowCount: number
}

/**
 * Logs into Material Bank using credentials from environment variables
 * @returns Browser and page instances for further automation
 */
export async function login(): Promise<LoginResult> {
  const apiKey = process.env.BROWSERLESS_API_KEY
  const email = process.env.MB_EMAIL
  const password = process.env.MB_PASSWORD

  if (!apiKey || !email || !password) {
    throw new Error('Missing required environment variables: BROWSERLESS_API_KEY, MB_EMAIL, MB_PASSWORD')
  }

  console.log('🔐 Connecting to Browserless...')
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=${apiKey}`
  })

  const page = await browser.newPage()
  
  console.log('🌐 Navigating to Material Bank login...')
  await page.goto('https://materialbank.com/login', { waitUntil: 'networkidle0' })
  
  console.log('📝 Entering credentials...')
  await page.type('input[name="email"]', email)
  await page.type('input[name="password"]', password)
  
  console.log('🚀 Submitting login form...')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type="submit"]')
  ])
  
  console.log('✅ Logged in to Material Bank')
  return { browser, page }
}

/**
 * Exports a Material Bank board to CSV
 * @param boardUrl - The full URL to the Material Bank board
 * @returns Path to the downloaded CSV file and row count
 */
export async function exportBoardCSV(boardUrl: string): Promise<ExportResult> {
  const { browser, page } = await login()
  
  try {
    console.log(`📋 Opening board: ${boardUrl}`)
    await page.goto(boardUrl, { waitUntil: 'networkidle0' })

    // Set up download behavior
    const downloadDir = path.resolve('./exports')
    await fs.mkdir(downloadDir, { recursive: true })
    
    const cdp = await page.target().createCDPSession()
    await cdp.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir
    })

    console.log('🔍 Looking for "Customize Export" button...')
    // Wait for and click "Customize Export" button
    await page.waitForSelector('button:has-text("Customize Export")', {
      visible: true,
      timeout: 10000
    })
    await page.click('button:has-text("Customize Export")')

    console.log('💾 Triggering CSV export...')
    // Wait for modal and click "Export CSV"
    await page.waitForSelector('button:has-text("Export CSV")', {
      visible: true,
      timeout: 5000
    })
    
    const timestamp = Date.now()
    await page.click('button:has-text("Export CSV")')

    // Wait for download to complete
    console.log('⏳ Waiting for download...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Find the downloaded file
    const files = await fs.readdir(downloadDir)
    const csvFiles = files.filter(f => f.endsWith('.csv'))
    
    if (csvFiles.length === 0) {
      throw new Error('No CSV file was downloaded')
    }

    // Get the most recent CSV file
    const csvFile = csvFiles[csvFiles.length - 1]
    const csvPath = path.join(downloadDir, csvFile)
    
    // Count rows
    const content = await fs.readFile(csvPath, 'utf-8')
    const rowCount = content.split('\n').length - 1 // Subtract header row

    console.log(`📦 CSV downloaded: ${csvPath} (${rowCount} products)`)
    
    return { csvPath, rowCount }
  } catch (error) {
    console.error('❌ Export failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

/**
 * Validates that required environment variables are set
 * @throws Error if any required variables are missing
 */
export function validateEnvironment(): void {
  const required = ['MB_EMAIL', 'MB_PASSWORD', 'BROWSERLESS_API_KEY']
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

