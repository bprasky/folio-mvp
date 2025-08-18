const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Helper function to parse price string to number
function parsePrice(priceString) {
  if (!priceString || typeof priceString !== 'string') return null;
  
  // Remove currency symbols, commas, and other non-numeric characters except decimal points
  const numericString = priceString.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(numericString);
  
  return isNaN(parsed) ? null : parsed;
}

async function migrateData() {
  try {
    console.log('🚀 Starting data migration from JSON files to database...');

    // 1. Migrate Users (Designers, Vendors, etc.)
    console.log('📁 Migrating users/designers...');
    const designersPath = path.join(process.cwd(), 'src', 'data', 'designers.json');
    if (fs.existsSync(designersPath)) {
      const designers = JSON.parse(fs.readFileSync(designersPath, 'utf8'));
      
      for (const designer of designers) {
        await prisma.user.upsert({
          where: { id: designer.id },
          update: {
            name: designer.name,
            bio: designer.bio,
            profileImage: designer.profileImage,
            role: 'DESIGNER',
            location: designer.location,
            specialties: designer.specialties || [],
            website: designer.website,
            instagram: designer.instagram,
            linkedin: designer.linkedin,
            followers: designer.metrics?.followers || 0,
            views: designer.metrics?.views || 0,
          },
          create: {
            id: designer.id,
            name: designer.name,
            bio: designer.bio,
            profileImage: designer.profileImage,
            role: 'DESIGNER',
            location: designer.location,
            specialties: designer.specialties || [],
            website: designer.website,
            instagram: designer.instagram,
            linkedin: designer.linkedin,
            followers: designer.metrics?.followers || 0,
            views: designer.metrics?.views || 0,
          },
        });
      }
      console.log(`✅ Migrated ${designers.length} designers`);
    }

    // 2. Migrate Homeowners
    console.log('📁 Migrating homeowners...');
    const homeownersPath = path.join(process.cwd(), 'src', 'data', 'homeowners.json');
    if (fs.existsSync(homeownersPath)) {
      const homeowners = JSON.parse(fs.readFileSync(homeownersPath, 'utf8'));
      
      for (const homeowner of homeowners) {
        await prisma.user.upsert({
          where: { id: homeowner.id },
          update: {
            name: homeowner.name,
            bio: homeowner.bio,
            profileImage: homeowner.avatar,
            role: 'HOMEOWNER',
            location: homeowner.location,
            budgetRange: homeowner.budgetRange,
            desiredRooms: homeowner.desiredRooms || [],
            serviceLevel: homeowner.serviceLevel,
            projectStatus: homeowner.projectStatus,
            followers: homeowner.metrics?.designersFollowed || 0,
          },
          create: {
            id: homeowner.id,
            name: homeowner.name,
            bio: homeowner.bio,
            profileImage: homeowner.avatar,
            role: 'HOMEOWNER',
            location: homeowner.location,
            budgetRange: homeowner.budgetRange,
            desiredRooms: homeowner.desiredRooms || [],
            serviceLevel: homeowner.serviceLevel,
            projectStatus: homeowner.projectStatus,
            followers: homeowner.metrics?.designersFollowed || 0,
          },
        });
      }
      console.log(`✅ Migrated ${homeowners.length} homeowners`);
    }

    // 3. Migrate Products
    console.log('📁 Migrating products...');
    const productsPath = path.join(process.cwd(), 'src', 'data', 'products2.json');
    if (fs.existsSync(productsPath)) {
      const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      
      for (const product of products) {
        await prisma.product.upsert({
          where: { id: product.id },
          update: {
            name: product.name,
            description: product.description,
            price: parsePrice(product.price),
            imageUrl: product.image,
            category: product.category,
            brand: product.brand,
            url: product.url,
          },
          create: {
            id: product.id,
            name: product.name,
            description: product.description,
            price: parsePrice(product.price),
            imageUrl: product.image,
            category: product.category,
            brand: product.brand,
            url: product.url,
          },
        });
      }
      console.log(`✅ Migrated ${products.length} products`);
    }

    // 4. Migrate Projects with Images and Tags
    console.log('📁 Migrating projects...');
    const projectsPath = path.join(process.cwd(), 'src', 'data', 'projects.json');
    if (fs.existsSync(projectsPath)) {
      const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
      
      for (const project of projects) {
        // Map invalid designer IDs to valid ones
        const validDesignerId = (project.designerId === 'current-designer' || !project.designerId) 
          ? 'designer-1' 
          : project.designerId;

        // Create or update project
        const dbProject = await prisma.project.upsert({
          where: { id: project.id },
          update: {
            name: project.name,
            description: project.description,
            category: project.category,
            ownerId: validDesignerId, // Use designer as owner
            designerId: validDesignerId,
            status: project.status || 'draft',
            views: project.metrics?.views || 0,
            saves: project.metrics?.saves || 0,
            shares: project.metrics?.shares || 0,
          },
          create: {
            id: project.id,
            name: project.name,
            description: project.description,
            category: project.category,
            ownerId: validDesignerId, // Use designer as owner
            designerId: validDesignerId,
            status: project.status || 'draft',
            views: project.metrics?.views || 0,
            saves: project.metrics?.saves || 0,
            shares: project.metrics?.shares || 0,
          },
        });

        // Migrate project images and tags
        if (project.images && project.images.length > 0) {
          for (const image of project.images) {
            const dbImage = await prisma.projectImage.upsert({
              where: { id: image.id },
              update: {
                url: image.url,
                name: image.name,
                room: image.room,
              },
              create: {
                id: image.id,
                url: image.url,
                name: image.name,
                room: image.room,
                projectId: project.id,
              },
            });

            // Migrate product tags
            if (image.tags && image.tags.length > 0) {
              for (const tag of image.tags) {
                // Create pending product if it doesn't exist
                let productId = tag.productId;
                if (tag.isPending && tag.productId.startsWith('pending-')) {
                  const pendingProduct = await prisma.product.upsert({
                    where: { id: tag.productId },
                    update: {
                      name: tag.productName,
                      imageUrl: tag.productImage,
                      price: parsePrice(tag.productPrice),
                      brand: tag.productBrand,
                      isPending: true,
                    },
                    create: {
                      id: tag.productId,
                      name: tag.productName,
                      imageUrl: tag.productImage,
                      price: parsePrice(tag.productPrice),
                      brand: tag.productBrand,
                      isPending: true,
                    },
                  });
                  productId = pendingProduct.id;
                }

                await prisma.productTag.upsert({
                  where: { id: tag.id },
                  update: {
                    x: tag.x,
                    y: tag.y,
                  },
                  create: {
                    id: tag.id,
                    x: tag.x,
                    y: tag.y,
                    productId: productId,
                    imageId: image.id,
                  },
                });
              }
            }
          }
        }
      }
      console.log(`✅ Migrated ${projects.length} projects with images and tags`);
    }

    // 5. Migrate Folders
    console.log('📁 Migrating folders...');
    const foldersPath = path.join(process.cwd(), 'src', 'data', 'folders.json');
    if (fs.existsSync(foldersPath)) {
      const folders = JSON.parse(fs.readFileSync(foldersPath, 'utf8'));
      
      for (const folder of folders) {
        const dbFolder = await prisma.folder.upsert({
          where: { id: folder.id },
          update: {
            name: folder.name,
          },
          create: {
            id: folder.id,
            name: folder.name,
            designerId: folder.designerId,
          },
        });

        // Migrate folder products
        if (folder.products && folder.products.length > 0) {
          for (const productId of folder.products) {
            await prisma.folderProduct.upsert({
              where: {
                folderId_productId: {
                  folderId: folder.id,
                  productId: productId,
                },
              },
              update: {},
              create: {
                folderId: folder.id,
                productId: productId,
              },
            });
          }
        }
      }
      console.log(`✅ Migrated ${folders.length} folders`);
    }

    console.log('🎉 Data migration completed successfully!');
    console.log('📝 Your data is now safely stored in the PostgreSQL database.');
    console.log('💡 You can now edit content on the site without losing data when code changes.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateData()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateData }; 