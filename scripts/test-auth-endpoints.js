#!/usr/bin/env node

/**
 * Test script for auth endpoints
 * Run with: node scripts/test-auth-endpoints.js
 */

const BASE_URL = 'http://localhost:3000';

async function testEndpoint(method, endpoint, headers = {}, body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    console.log(`\n🔍 Testing ${method} ${endpoint}`);
    if (body) console.log('Body:', body);
    if (Object.keys(headers).length > 0) console.log('Headers:', headers);

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();

    console.log(`✅ Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

    return { status: response.status, data };
  } catch (error) {
    console.error(`❌ Error testing ${endpoint}:`, error.message);
    return { status: 'ERROR', error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Auth Endpoint Tests\n');

  // Test 1: Check current session
  console.log('📋 Test 1: Check current session');
  await testEndpoint('GET', '/api/debug/whoami');

  // Test 2: Force logout (clear all cookies)
  console.log('\n📋 Test 2: Force logout');
  await testEndpoint('POST', '/api/auth/force-logout');

  // Test 3: Check session after force logout
  console.log('\n📋 Test 3: Check session after force logout');
  await testEndpoint('GET', '/api/debug/whoami');

  // Test 4: Elevate role to ADMIN (if MAINTENANCE_TOKEN is set)
  const maintenanceToken = process.env.MAINTENANCE_TOKEN;
  if (maintenanceToken) {
    console.log('\n📋 Test 4: Elevate role to ADMIN');
    await testEndpoint('POST', '/api/maintenance/elevate-role', 
      { 'x-maintenance-token': maintenanceToken },
      { email: 'Vendor@folio.com', role: 'ADMIN' }
    );
  } else {
    console.log('\n⚠️  MAINTENANCE_TOKEN not set, skipping role elevation test');
    console.log('Set it with: export MAINTENANCE_TOKEN=abc123');
  }

  console.log('\n✨ Tests completed!');
  console.log('\nNext steps:');
  console.log('1. Visit http://localhost:3000/api/debug/whoami in your browser');
  console.log('2. Try signing out from the UI');
  console.log('3. Check the debug endpoint again to verify session is cleared');
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/api/debug/whoami`);
    if (response.ok) {
      console.log('✅ Server is running on', BASE_URL);
      return true;
    }
  } catch (error) {
    console.error('❌ Server is not running on', BASE_URL);
    console.log('Please start your dev server with: npm run dev');
    return false;
  }
}

// Run tests if server is available
checkServer().then(isRunning => {
  if (isRunning) {
    runTests();
  }
}); 