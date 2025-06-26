import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    // Load designers from JSON file
    const designersPath = join(process.cwd(), 'data', 'designers.json');
    const designersContent = await readFile(designersPath, 'utf-8');
    const designers = JSON.parse(designersContent);

    return NextResponse.json(designers);
  } catch (error) {
    console.error('Error fetching designers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch designers' },
      { status: 500 }
    );
  }
} 