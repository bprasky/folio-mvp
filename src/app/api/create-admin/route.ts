import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const adminData = {
      email: 'newadmin@folio.com',
      name: 'New Admin User',
      password: 'admin123',
      role: 'ADMIN' as const
    };

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: adminData.email }
    });

    if (existingUser) {
      // Update existing user
      const hashedPassword = await bcrypt.hash(adminData.password, 10);
      await prisma.user.update({
        where: { email: adminData.email },
        data: { 
          password: hashedPassword,
          role: 'ADMIN'
        }
      });
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(adminData.password, 10);
      await prisma.user.create({
        data: {
          email: adminData.email,
          name: adminData.name,
          password: hashedPassword,
          role: adminData.role
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully!',
      credentials: {
        email: adminData.email,
        password: adminData.password,
        role: adminData.role
      }
    });

  } catch (error) {
    console.error('Error creating admin user:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create admin user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 