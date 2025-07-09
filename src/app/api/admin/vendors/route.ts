import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    // Load vendors from JSON file
    const vendorsPath = join(process.cwd(), 'data', 'vendors.json');
    const vendorsContent = await readFile(vendorsPath, 'utf-8');
    const vendorsData = JSON.parse(vendorsContent);

    return NextResponse.json({
      success: true,
      vendors: vendorsData
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vendors' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, website, contactEmail, specialties } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Vendor name is required' },
        { status: 400 }
      );
    }

    // Load existing vendors
    const vendorsPath = join(process.cwd(), 'data', 'vendors.json');
    let vendors = [];
    try {
      const vendorsContent = await readFile(vendorsPath, 'utf-8');
      vendors = JSON.parse(vendorsContent);
    } catch (error) {
      // File doesn't exist yet, start with empty array
      vendors = [];
    }

    // Generate vendor ID
    const vendorId = `vendor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create new vendor
    const newVendor = {
      id: vendorId,
      name,
      description: description || '',
      website: website || '',
      contactEmail: contactEmail || '',
      specialties: specialties || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add to vendors array
    vendors.push(newVendor);

    // Save updated vendors
    await writeFile(vendorsPath, JSON.stringify(vendors, null, 2));

    return NextResponse.json({
      success: true,
      vendor: newVendor,
      message: 'Vendor created successfully'
    });

  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create vendor' },
      { status: 500 }
    );
  }
} 