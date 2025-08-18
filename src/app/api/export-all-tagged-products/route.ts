import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Load projects from file
const loadProjects = (): any[] => {
  try {
    const PROJECTS_FILE = path.join(process.cwd(), 'src', 'data', 'projects.json');
    if (fs.existsSync(PROJECTS_FILE)) {
      const data = fs.readFileSync(PROJECTS_FILE, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
};

export async function GET(request: NextRequest) {
  try {
    const projects = loadProjects();
    const allTaggedProducts: any[] = [];

    // Collect all tagged products from all projects
    projects.forEach(project => {
      project.images?.forEach((image: any) => {
        image.tags?.forEach((tag: any) => {
          allTaggedProducts.push({
            project: project.name,
            projectId: project.id,
            projectClient: project.client,
            projectDescription: project.description,
            room: image.room || 'Unspecified',
            imageName: image.name,
            imageUrl: image.url,
            productName: tag.productName,
            productBrand: tag.productBrand,
            productPrice: tag.productPrice,
            productUrl: tag.productUrl,
            productDescription: tag.productDescription,
            productCategory: tag.productCategory,
            vendorName: tag.vendorName || tag.productBrand,
            coordinates: `(${tag.x?.toFixed(1) || 0}%, ${tag.y?.toFixed(1) || 0}%)`,
            isPending: tag.isPending || false,
            dateTagged: project.createdAt || new Date().toISOString().split('T')[0],
            designerId: project.designerId,
            notes: tag.notes || ''
          });
        });
      });
    });

    return NextResponse.json({
      products: allTaggedProducts,
      totalCount: allTaggedProducts.length,
      summary: {
        totalProjects: projects.length,
        totalProducts: allTaggedProducts.length,
        pendingProducts: allTaggedProducts.filter(p => p.isPending).length,
        approvedProducts: allTaggedProducts.filter(p => !p.isPending).length,
        uniqueVendors: Array.from(new Set(allTaggedProducts.map(p => p.vendorName))).length,
        uniqueDesigners: Array.from(new Set(allTaggedProducts.map(p => p.designerId))).length
      }
    });

  } catch (error) {
    console.error('Export all tagged products error:', error);
    return NextResponse.json(
      { error: 'Failed to export tagged products' },
      { status: 500 }
    );
  }
} 