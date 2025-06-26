import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface TaggedProduct {
  project: string;
  projectClient: string;
  projectDescription: string;
  room: string;
  imageName: string;
  imageUrl: string;
  productName: string;
  productBrand: string;
  productPrice: string;
  productUrl: string;
  productDescription: string;
  productCategory: string;
  vendorName: string;
  coordinates: string;
  isPending: boolean;
  dateTagged: string;
  notes?: string;
  productImage?: string;
}

// Load projects from file
const loadProjects = (): any[] => {
  try {
    const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json');
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
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const format = searchParams.get('format') || 'csv';
    const roomFilter = searchParams.get('room');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Load real project data
    const projects = loadProjects();
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Flatten the data structure for export
    const exportData: TaggedProduct[] = [];
    
    project.images?.forEach((image: any) => {
      // Filter by room if specified
      if (roomFilter && image.room?.toLowerCase() !== roomFilter.toLowerCase()) {
        return;
      }

      image.tags?.forEach((tag: any) => {
        exportData.push({
          project: project.name || 'Untitled Project',
          projectClient: project.client || 'N/A',
          projectDescription: project.description || 'No description available',
          room: image.room || 'Unspecified',
          imageName: image.name || 'Unnamed Image',
          imageUrl: image.url || '',
          productName: tag.productName || 'Unknown Product',
          productBrand: tag.productBrand || 'Unknown Brand',
          productPrice: tag.productPrice ? `$${tag.productPrice}` : 'Price not available',
          productUrl: tag.productUrl || 'URL not available',
          productDescription: tag.productDescription || 'No description available',
          productCategory: tag.productCategory || 'Uncategorized',
          vendorName: tag.productBrand || 'Unknown Vendor',
          coordinates: `(${tag.x?.toFixed(1) || 0}%, ${tag.y?.toFixed(1) || 0}%)`,
          isPending: tag.isPending || false,
          dateTagged: tag.dateTagged || new Date().toISOString().split('T')[0],
          notes: tag.notes || '',
          productImage: tag.productImage || ''
        });
      });
    });

    if (exportData.length === 0) {
      return NextResponse.json({ error: 'No tagged products found for this project' }, { status: 404 });
    }

    if (format === 'csv') {
      // Generate comprehensive CSV content
      const headers = [
        'Project Name',
        'Client',
        'Project Description',
        'Room',
        'Image Name',
        'Image URL',
        'Product Name',
        'Brand',
        'Price',
        'Product URL',
        'Product Description',
        'Category',
        'Vendor',
        'Tag Coordinates',
        'Status',
        'Date Tagged',
        'Designer Notes',
        'Product Image URL'
      ];

      const csvRows = [
        headers.join(','),
        ...exportData.map(row => [
          `"${row.project.replace(/"/g, '""')}"`,
          `"${row.projectClient.replace(/"/g, '""')}"`,
          `"${row.projectDescription.replace(/"/g, '""')}"`,
          `"${row.room.replace(/"/g, '""')}"`,
          `"${row.imageName.replace(/"/g, '""')}"`,
          `"${row.imageUrl}"`,
          `"${row.productName.replace(/"/g, '""')}"`,
          `"${row.productBrand.replace(/"/g, '""')}"`,
          `"${row.productPrice}"`,
          `"${row.productUrl}"`,
          `"${row.productDescription.replace(/"/g, '""')}"`,
          `"${row.productCategory.replace(/"/g, '""')}"`,
          `"${row.vendorName.replace(/"/g, '""')}"`,
          `"${row.coordinates}"`,
          `"${row.isPending ? 'Pending Approval' : 'Approved'}"`,
          `"${row.dateTagged}"`,
          `"${(row.notes || '').replace(/"/g, '""')}"`,
          `"${row.productImage || ''}"`
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const fileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Tagged_Materials${roomFilter ? `_${roomFilter}` : ''}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${fileName}"`
        }
      });
    }

    // Return JSON data for other formats or further processing
    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        client: project.client,
        description: project.description,
        designer: project.designerId,
        status: project.status
      },
      exportData,
      totalProducts: exportData.length,
      rooms: Array.from(new Set(exportData.map(item => item.room))),
      categories: Array.from(new Set(exportData.map(item => item.productCategory))),
      vendors: Array.from(new Set(exportData.map(item => item.vendorName)))
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export project data' },
      { status: 500 }
    );
  }
} 