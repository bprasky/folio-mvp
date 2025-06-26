import { NextResponse } from 'next/server';

interface ProjectImage {
  id: string;
  url: string;
  name: string;
  tags: ProductTag[];
}

interface ProductTag {
  id: string;
  x: number;
  y: number;
  product: {
    id: string;
    name: string;
    brand: string;
    price: string;
    image: string;
    vendorId: string;
  };
}

export async function POST(request: Request) {
  try {
    const projectData = await request.json();
    
    const {
      name,
      description,
      category,
      client,
      designerId,
      images
    } = projectData;
    
    if (!name?.trim() || !category?.trim() || !designerId?.trim()) {
      return NextResponse.json(
        { error: 'Project name, category, and designer are required' },
        { status: 400 }
      );
    }

    const newProject = {
      id: `project-${Date.now()}`,
      name: name.trim(),
      description: description || '',
      category: category.trim(),
      client: client || '',
      designerId: designerId.trim(),
      images: images || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      metrics: {
        views: 0,
        saves: 0,
        shares: 0
      }
    };

    // In a real app, this would:
    // 1. Save project to database
    // 2. Associate with designer profile
    // 3. Create image records with tags
    // 4. Update vendor product analytics
    
    console.log('Creating project:', newProject);
    
    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
} 