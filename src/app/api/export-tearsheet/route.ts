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
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const roomFilter = searchParams.get('room');
    const style = searchParams.get('style') || 'detailed'; // 'detailed' or 'summary'

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Load real project data
    const projects = loadProjects();
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Collect all tagged products
    const taggedProducts: any[] = [];
    
    project.images?.forEach((image: any) => {
      // Filter by room if specified
      if (roomFilter && image.room?.toLowerCase() !== roomFilter.toLowerCase()) {
        return;
      }

      image.tags?.forEach((tag: any) => {
        taggedProducts.push({
          ...tag,
          room: image.room,
          imageName: image.name,
          imageUrl: image.url,
          projectName: project.name,
          projectClient: project.client,
          projectDescription: project.description
        });
      });
    });

    if (taggedProducts.length === 0) {
      return NextResponse.json({ error: 'No tagged products found for this project' }, { status: 404 });
    }

    // Generate HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${project.name} - Product Specification Sheet</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            background: white;
          }
          
          .header {
            text-align: center;
            padding: 30px 20px;
            border-bottom: 3px solid #000;
            margin-bottom: 30px;
          }
          
          .project-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .project-info {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
          }
          
          .project-description {
            font-size: 11px;
            max-width: 600px;
            margin: 0 auto;
            line-height: 1.5;
          }
          
          .product-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            padding: 0 20px;
          }
          
          .product-item {
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            page-break-inside: avoid;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .product-image {
            width: 100%;
            height: 200px;
            object-fit: cover;
            background: #f5f5f5;
          }
          
          .product-details {
            padding: 15px;
          }
          
          .product-name {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 8px;
            color: #000;
          }
          
          .product-brand {
            font-size: 12px;
            color: #666;
            margin-bottom: 6px;
          }
          
          .product-price {
            font-size: 13px;
            font-weight: bold;
            color: #2c5282;
            margin-bottom: 8px;
          }
          
          .product-room {
            font-size: 11px;
            background: #f7fafc;
            padding: 4px 8px;
            border-radius: 4px;
            display: inline-block;
            margin-bottom: 8px;
          }
          
          .product-url {
            font-size: 10px;
            color: #4a5568;
            word-break: break-all;
            margin-bottom: 8px;
          }
          
          .product-notes {
            font-size: 11px;
            font-style: italic;
            color: #666;
            background: #fafafa;
            padding: 8px;
            border-radius: 4px;
            margin-top: 8px;
          }
          
          .status-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 12px;
            color: white;
            display: inline-block;
          }
          
          .status-approved {
            background: #48bb78;
          }
          
          .status-pending {
            background: #ed8936;
          }
          
          .footer {
            text-align: center;
            padding: 30px 20px;
            border-top: 1px solid #ddd;
            margin-top: 40px;
            font-size: 10px;
            color: #666;
          }
          
          .page-break {
            page-break-before: always;
          }
          
          @media print {
            .product-item {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="project-title">${project.name || 'Untitled Project'}</div>
          <div class="project-info">
            Client: ${project.client || 'N/A'} | 
            Designer: ${project.designerId || 'N/A'} | 
            ${roomFilter ? `Room: ${roomFilter}` : 'All Rooms'}
          </div>
          ${project.description ? `<div class="project-description">${project.description}</div>` : ''}
        </div>
        
        <div class="product-grid">
          ${taggedProducts.map((product, index) => `
            <div class="product-item ${index > 0 && index % 6 === 0 ? 'page-break' : ''}">
              ${product.productImage ? `
                <img src="${product.productImage}" alt="${product.productName}" class="product-image" />
              ` : `
                <div class="product-image" style="display: flex; align-items: center; justify-content: center; background: #f0f0f0; color: #999;">
                  No Image Available
                </div>
              `}
              <div class="product-details">
                <div class="product-name">${product.productName || 'Unknown Product'}</div>
                <div class="product-brand">${product.productBrand || 'Unknown Brand'}</div>
                <div class="product-price">$${product.productPrice || 'Price not available'}</div>
                <div class="product-room">📍 ${product.room || 'Unspecified Room'}</div>
                <div class="product-url">${product.productUrl || 'URL not available'}</div>
                <span class="status-badge ${product.isPending ? 'status-pending' : 'status-approved'}">
                  ${product.isPending ? 'Pending Approval' : 'Approved'}
                </span>
                ${product.notes ? `<div class="product-notes">Notes: ${product.notes}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="footer">
          <div>Generated on ${new Date().toLocaleDateString()}</div>
          <div>Total Products: ${taggedProducts.length}</div>
        </div>
      </body>
      </html>
    `;

    // For now, return HTML content (you can integrate Puppeteer later)
    // This allows testing the HTML structure before adding PDF generation
    const fileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Tearsheet${roomFilter ? `_${roomFilter}` : ''}.html`;

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });

  } catch (error) {
    console.error('Tearsheet generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate tearsheet' },
      { status: 500 }
    );
  }
} 