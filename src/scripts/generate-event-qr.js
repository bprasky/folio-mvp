const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Generate QR codes for designer signup at events
async function generateEventQR(eventId, eventName) {
  const signupUrl = `http://localhost:3000/signup/designer?event=${eventId}`;
  
  console.log(`🎫 Generating QR code for ${eventName}...`);
  console.log(`📱 Signup URL: ${signupUrl}`);
  
  try {
    // Generate QR code as PNG
    const qrCodeDataURL = await QRCode.toDataURL(signupUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Convert data URL to buffer
    const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create output directory
    const outputDir = path.join(__dirname, '../public/qr-codes');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save QR code
    const filename = `event-${eventId}-designer-signup.png`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, buffer);
    
    console.log(`✅ QR code saved: ${filepath}`);
    console.log(`📊 File size: ${(buffer.length / 1024).toFixed(1)} KB`);
    
    return filepath;
    
  } catch (error) {
    console.error('❌ Failed to generate QR code:', error);
    throw error;
  }
}

// Generate QR codes for multiple events
async function generateAllEventQRs() {
  const events = [
    { id: 'nycxdesign-2025', name: 'NYCxDesign 2025' },
    { id: 'salone-milano-2025', name: 'Salone del Mobile Milano 2025' },
    { id: 'icff-2025', name: 'ICFF 2025' },
    { id: 'neocon-2025', name: 'NeoCon 2025' }
  ];
  
  console.log('🎫 Generating QR codes for all events...\n');
  
  for (const event of events) {
    try {
      await generateEventQR(event.id, event.name);
      console.log(''); // Empty line for spacing
    } catch (error) {
      console.error(`Failed to generate QR for ${event.name}:`, error);
    }
  }
  
  console.log('🎉 All QR codes generated!');
  console.log('\n📋 Next steps:');
  console.log('1. Print the QR codes from /public/qr-codes/');
  console.log('2. Place them at event booths and registration areas');
  console.log('3. Designers can scan to start the onboarding process');
  console.log('4. Track signups in the event_signups table');
}

// Generate a single QR code
async function generateSingleQR() {
  const eventId = process.argv[2];
  const eventName = process.argv[3] || eventId;
  
  if (!eventId) {
    console.log('Usage: node generate-event-qr.js <eventId> [eventName]');
    console.log('Example: node generate-event-qr.js nycxdesign-2025 "NYCxDesign 2025"');
    return;
  }
  
  await generateEventQR(eventId, eventName);
}

// Run the script
if (require.main === module) {
  if (process.argv.includes('--all')) {
    generateAllEventQRs();
  } else {
    generateSingleQR();
  }
}

module.exports = { generateEventQR, generateAllEventQRs }; 