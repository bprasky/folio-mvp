import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { scrapeDesignerWebsite } from '@/lib/scraper/browserless';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { userId, website } = await request.json();

    // Validate required fields
    if (!userId || !website) {
      return NextResponse.json(
        { error: 'User ID and website are required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        designerProjects: {
          include: {
            images: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Scrape the website
    console.log(`Reimporting portfolio for user ${userId} from ${website}`);
    const scrapedData = await scrapeDesignerWebsite(website);

    if (!scrapedData || !scrapedData.projects || scrapedData.projects.length === 0) {
      return NextResponse.json(
        { error: 'No projects found on website or scraping failed' },
        { status: 400 }
      );
    }

    // Update user profile with scraped data
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: scrapedData.companyName || user.name,
        bio: scrapedData.about || user.bio,
        profileImage: scrapedData.logo || user.profileImage,
        specialties: scrapedData.projects?.map((p: any) => p.category).filter(Boolean) || user.specialties
      }
    });

    let projectsCreated = 0;
    let projectsUpdated = 0;

    // Process scraped projects
    for (const projectData of scrapedData.projects) {
      // Check if project already exists (by name)
      const existingProject = user.designerProjects.find(
        p => p.name.toLowerCase() === projectData.title.toLowerCase()
      );

      if (existingProject) {
        // Update existing project
        await prisma.project.update({
          where: { id: existingProject.id },
          data: {
            description: projectData.description || existingProject.description,
            category: projectData.category || existingProject.category
          }
        });

        // Update project images
        for (const imageUrl of projectData.images) {
          // Check if image already exists
          const existingImage = existingProject.images.find(
            img => img.url === imageUrl
          );

          if (!existingImage) {
            await prisma.projectImage.create({
              data: {
                url: imageUrl,
                name: `${projectData.title} - Image`,
                projectId: existingProject.id
              }
            });
          }
        }
        projectsUpdated++;
      } else {
        // Create new project
        const newProject = await prisma.project.create({
          data: {
            name: projectData.title,
            description: projectData.description,
            category: projectData.category || 'residential',
            status: 'published',
            designerId: userId
          }
        });

        // Create project images
        for (const imageUrl of projectData.images) {
          await prisma.projectImage.create({
            data: {
              url: imageUrl,
              name: `${projectData.title} - Image`,
              projectId: newProject.id
            }
          });
        }
        projectsCreated++;
      }
    }

    // Store scraping record
    try {
      await prisma.$executeRaw`
        INSERT INTO website_scrapes (id, url, scraped_at, success, data, created_at, updated_at)
        VALUES (gen_random_uuid(), ${website}, NOW(), true, ${JSON.stringify(scrapedData)}, NOW(), NOW())
      `;
    } catch (error) {
      console.error('Failed to store scraping record:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Portfolio reimported successfully',
      projectsCreated,
      projectsUpdated,
      totalProjects: projectsCreated + projectsUpdated
    });

  } catch (error) {
    console.error('Reimport error:', error);
    return NextResponse.json(
      { error: 'Failed to reimport portfolio' },
      { status: 500 }
    );
  }
} 