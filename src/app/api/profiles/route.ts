import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// File paths for different profile types
const DESIGNERS_FILE = path.join(process.cwd(), 'data', 'designers.json');
const VENDORS_FILE = path.join(process.cwd(), 'data', 'vendors.json');
const HOMEOWNERS_FILE = path.join(process.cwd(), 'data', 'homeowners.json');

// Ensure data directory exists
const ensureDataDirectory = () => {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Load profiles by type
const loadProfiles = (type: string): any[] => {
  try {
    ensureDataDirectory();
    let filePath: string;
    
    switch (type) {
      case 'designer':
        filePath = DESIGNERS_FILE;
        break;
      case 'vendor':
        filePath = VENDORS_FILE;
        break;
      case 'homeowner':
        filePath = HOMEOWNERS_FILE;
        break;
      default:
        return [];
    }
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error(`Error loading ${type} profiles:`, error);
    return [];
  }
};

// Save profiles by type
const saveProfiles = (type: string, profiles: any[]) => {
  try {
    ensureDataDirectory();
    let filePath: string;
    
    switch (type) {
      case 'designer':
        filePath = DESIGNERS_FILE;
        break;
      case 'vendor':
        filePath = VENDORS_FILE;
        break;
      case 'homeowner':
        filePath = HOMEOWNERS_FILE;
        break;
      default:
        return;
    }
    
    fs.writeFileSync(filePath, JSON.stringify(profiles, null, 2));
  } catch (error) {
    console.error(`Error saving ${type} profiles:`, error);
  }
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    
    if (!role || !['designer', 'vendor', 'homeowner'].includes(role)) {
      return NextResponse.json(
        { error: 'Valid role parameter is required (designer, vendor, homeowner)' },
        { status: 400 }
      );
    }
    
    const profiles = loadProfiles(role);
    return NextResponse.json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profiles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { role, ...profileData } = await request.json();
    
    if (!role || !['designer', 'vendor', 'homeowner'].includes(role)) {
      return NextResponse.json(
        { error: 'Valid role is required (designer, vendor, homeowner)' },
        { status: 400 }
      );
    }
    
    const profiles = loadProfiles(role);
    
    let newProfile: any = {
      id: `${role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...profileData
    };
    
    // Add role-specific defaults
    if (role === 'designer') {
      newProfile = {
        ...newProfile,
        name: profileData.name || 'New Designer',
        bio: profileData.bio || 'Interior designer specializing in modern spaces',
        profileImage: profileData.profileImage || `https://randomuser.me/api/portraits/women/${Math.floor(Math.random() * 50)}.jpg`,
        folders: [],
        events: [],
        metrics: {
          savedProducts: 0,
          events: 0,
          followers: Math.floor(Math.random() * 1000) + 100
        }
      };
    } else if (role === 'vendor') {
      newProfile = {
        ...newProfile,
        name: profileData.name || 'New Vendor',
        description: profileData.description || 'Premium home decor and furniture',
        logo: profileData.logo || `https://source.unsplash.com/random/200x200?company,logo`,
        products: [],
        events: [],
        metrics: {
          products: 0,
          events: 0,
          followers: Math.floor(Math.random() * 500) + 50
        }
      };
    } else if (role === 'homeowner') {
      newProfile = {
        ...newProfile,
        name: profileData.name || 'New Homeowner',
        location: profileData.location || 'City, State',
        budgetRange: profileData.budgetRange || '$10k-$50k',
        desiredRooms: profileData.desiredRooms || ['Living Room'],
        serviceLevel: profileData.serviceLevel || 'Designer guidance',
        projectStatus: 'planning',
        memberSince: new Date().toISOString().split('T')[0]
      };
    }
    
    profiles.push(newProfile);
    saveProfiles(role, profiles);
    
    return NextResponse.json(newProfile, { status: 201 });
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    );
  }
} 