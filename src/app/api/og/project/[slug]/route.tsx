import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Fetch project data
    const post = await prisma.projectPost.findUnique({
      where: { slug },
      select: {
        excerpt: true,
        project: {
          select: {
            title: true,
            description: true,
            designer: {
              select: {
                name: true,
                studio: true,
              },
            },
            images: {
              select: {
                url: true,
                displayOrder: true,
              },
              orderBy: {
                displayOrder: 'asc',
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!post) {
      return new Response('Not found', { status: 404 });
    }

    const { project } = post;
    const heroImage = project.images[0]?.url;
    const designerName = project.designer.studio || project.designer.name;

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'flex-end',
            position: 'relative',
            background: '#1A1A1A',
          }}
        >
          {/* Hero Image Background */}
          {heroImage && (
            <img
              src={heroImage}
              alt=""
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          )}

          {/* Gradient Overlay for Text Legibility */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '60%',
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 100%)',
            }}
          />

          {/* Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '60px 80px',
              gap: '16px',
              position: 'relative',
              zIndex: 10,
            }}
          >
            {/* Project Title */}
            <div
              style={{
                fontSize: 72,
                fontWeight: 400,
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                fontFamily: 'Georgia, serif',
                textShadow: '0 4px 24px rgba(0,0,0,0.3)',
              }}
            >
              {project.title}
            </div>

            {/* Designer Attribution */}
            <div
              style={{
                fontSize: 32,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.9)',
                letterSpacing: '0.01em',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {designerName}
            </div>

            {/* Folio Mark */}
            <div
              style={{
                position: 'absolute',
                bottom: 60,
                right: 80,
                fontSize: 24,
                fontWeight: 300,
                color: 'rgba(255,255,255,0.6)',
                letterSpacing: '0.1em',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              FOLIO
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
