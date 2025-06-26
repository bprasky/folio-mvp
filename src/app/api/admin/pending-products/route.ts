import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for demo purposes
// In production, this would be stored in a database
let pendingProducts: any[] = [];

export async function GET(request: NextRequest) {
  try {
    // Return all pending products with sorting and filtering options
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'taggedAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const vendor = searchParams.get('vendor');
    const designer = searchParams.get('designer');
    const search = searchParams.get('search');

    let filteredProducts = [...pendingProducts];

    // Apply filters
    if (vendor) {
      filteredProducts = filteredProducts.filter(product => 
        product.brand?.toLowerCase().includes(vendor.toLowerCase())
      );
    }

    if (designer) {
      filteredProducts = filteredProducts.filter(product => 
        product.taggedBy?.toLowerCase().includes(designer.toLowerCase())
      );
    }

    if (search) {
      filteredProducts = filteredProducts.filter(product => 
        product.name?.toLowerCase().includes(search.toLowerCase()) ||
        product.brand?.toLowerCase().includes(search.toLowerCase()) ||
        product.taggedBy?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply sorting
    filteredProducts.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'taggedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (sortBy === 'price') {
        aValue = typeof aValue === 'string' ? parseFloat(aValue.replace(/[^0-9.]/g, '')) : aValue;
        bValue = typeof bValue === 'string' ? parseFloat(bValue.replace(/[^0-9.]/g, '')) : bValue;
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    return NextResponse.json({
      products: filteredProducts,
      total: filteredProducts.length,
      totalPending: pendingProducts.length
    });

  } catch (error) {
    console.error('Error fetching pending products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const productData = await request.json();
    
    const newPendingProduct = {
      id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...productData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      taggedAt: productData.taggedAt || new Date().toISOString(),
      taggedBy: productData.taggedBy || 'Unknown Designer',
      sourceUrl: productData.sourceUrl || '',
      timesTagged: 1
    };

    // Check if this product already exists (by URL or name+brand)
    const existingProduct = pendingProducts.find(product => 
      product.sourceUrl === newPendingProduct.sourceUrl ||
      (product.name === newPendingProduct.name && product.brand === newPendingProduct.brand)
    );

    if (existingProduct) {
      // Increment times tagged and add designer to list
      existingProduct.timesTagged = (existingProduct.timesTagged || 1) + 1;
      existingProduct.taggedBy = Array.isArray(existingProduct.taggedBy) 
        ? [...existingProduct.taggedBy, newPendingProduct.taggedBy]
        : [existingProduct.taggedBy, newPendingProduct.taggedBy];
      existingProduct.lastTaggedAt = newPendingProduct.taggedAt;
      
      return NextResponse.json(existingProduct);
    } else {
      pendingProducts.push(newPendingProduct);
      return NextResponse.json(newPendingProduct);
    }

  } catch (error) {
    console.error('Error creating pending product:', error);
    return NextResponse.json(
      { error: 'Failed to create pending product' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, action, ...updateData } = await request.json();
    
    const productIndex = pendingProducts.findIndex(product => product.id === id);
    
    if (productIndex === -1) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      // Move to main products catalog (in real app, this would be a database operation)
      const approvedProduct = {
        ...pendingProducts[productIndex],
        status: 'approved',
        approvedAt: new Date().toISOString(),
        isPending: false
      };
      
      // Remove from pending products
      pendingProducts.splice(productIndex, 1);
      
      return NextResponse.json(approvedProduct);
    } else if (action === 'reject') {
      const rejectedProduct = {
        ...pendingProducts[productIndex],
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectionReason: updateData.rejectionReason || ''
      };
      
      // Remove from pending products
      pendingProducts.splice(productIndex, 1);
      
      return NextResponse.json(rejectedProduct);
    } else {
      // Update product data
      pendingProducts[productIndex] = {
        ...pendingProducts[productIndex],
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      
      return NextResponse.json(pendingProducts[productIndex]);
    }

  } catch (error) {
    console.error('Error updating pending product:', error);
    return NextResponse.json(
      { error: 'Failed to update pending product' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const productIndex = pendingProducts.findIndex(product => product.id === id);
    
    if (productIndex === -1) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    const deletedProduct = pendingProducts.splice(productIndex, 1)[0];
    
    return NextResponse.json(deletedProduct);

  } catch (error) {
    console.error('Error deleting pending product:', error);
    return NextResponse.json(
      { error: 'Failed to delete pending product' },
      { status: 500 }
    );
  }
} 