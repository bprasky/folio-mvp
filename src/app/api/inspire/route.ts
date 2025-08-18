import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';

interface InspirePost {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  tags: string[];
  author: {
    name: string;
    avatar?: string;
  };
  likes: number;
  saves: number;
  createdAt: string;
  featured: boolean;
}

// Mock data for inspiration posts
const MOCK_INSPIRE_POSTS: InspirePost[] = [
  {
    id: '1',
    title: 'Minimalist Living Room Design',
    description: 'A serene and clean living space with neutral tones and natural materials.',
    imageUrl: 'https://source.unsplash.com/800x600?interior,minimalist,living',
    category: 'Living Room',
    tags: ['minimalist', 'neutral', 'modern', 'clean'],
    author: {
      name: 'Sarah Johnson',
      avatar: 'https://source.unsplash.com/150x150?portrait,woman'
    },
    likes: 245,
    saves: 89,
    createdAt: '2024-01-15T10:30:00Z',
    featured: true
  },
  {
    id: '2',
    title: 'Scandinavian Kitchen Excellence',
    description: 'Light woods, white surfaces, and functional design create the perfect kitchen.',
    imageUrl: 'https://source.unsplash.com/800x600?kitchen,scandinavian,white',
    category: 'Kitchen',
    tags: ['scandinavian', 'white', 'wood', 'functional'],
    author: {
      name: 'Erik Lindqvist',
      avatar: 'https://source.unsplash.com/150x150?portrait,man'
    },
    likes: 189,
    saves: 67,
    createdAt: '2024-01-14T14:20:00Z',
    featured: false
  },
  {
    id: '3',
    title: 'Industrial Loft Bedroom',
    description: 'Raw materials and urban aesthetics merge in this stunning bedroom design.',
    imageUrl: 'https://source.unsplash.com/800x600?bedroom,industrial,loft',
    category: 'Bedroom',
    tags: ['industrial', 'loft', 'raw', 'urban'],
    author: {
      name: 'Marcus Chen',
      avatar: 'https://source.unsplash.com/150x150?portrait,asian'
    },
    likes: 312,
    saves: 156,
    createdAt: '2024-01-13T16:45:00Z',
    featured: true
  },
  {
    id: '4',
    title: 'Bohemian Workspace',
    description: 'Creative and eclectic home office with vibrant colors and textures.',
    imageUrl: 'https://source.unsplash.com/800x600?office,bohemian,colorful',
    category: 'Office',
    tags: ['bohemian', 'colorful', 'eclectic', 'creative'],
    author: {
      name: 'Luna Rodriguez',
      avatar: 'https://source.unsplash.com/150x150?portrait,woman,latina'
    },
    likes: 167,
    saves: 92,
    createdAt: '2024-01-12T11:15:00Z',
    featured: false
  },
  {
    id: '5',
    title: 'Modern Bathroom Oasis',
    description: 'Luxury meets functionality in this spa-like bathroom retreat.',
    imageUrl: 'https://source.unsplash.com/800x600?bathroom,modern,luxury',
    category: 'Bathroom',
    tags: ['modern', 'luxury', 'spa', 'retreat'],
    author: {
      name: 'Alex Thompson',
      avatar: 'https://source.unsplash.com/150x150?portrait,man,professional'
    },
    likes: 278,
    saves: 134,
    createdAt: '2024-01-11T09:30:00Z',
    featured: true
  }
];

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const limit = searchParams.get('limit');

    let posts = [...MOCK_INSPIRE_POSTS];

    // Filter by category if specified
    if (category && category !== 'all') {
      posts = posts.filter(post => 
        post.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Filter by featured if specified
    if (featured === 'true') {
      posts = posts.filter(post => post.featured);
    }

    // Sort by creation date (newest first)
    posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Limit results if specified
    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum) && limitNum > 0) {
        posts = posts.slice(0, limitNum);
      }
    }

    return NextResponse.json(posts);
  } catch (error) {
    console.error('Error fetching inspiration posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inspiration posts' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { title, description, imageUrl, category, tags } = data;

    // Validate required fields
    if (!title || !description || !imageUrl || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create new inspire post
    const newPost: InspirePost = {
      id: Date.now().toString(),
      title,
      description,
      imageUrl,
      category,
      tags: tags || [],
      author: {
        name: session.user?.name || 'Anonymous',
        avatar: session.user?.image || undefined
      },
      likes: 0,
      saves: 0,
      createdAt: new Date().toISOString(),
      featured: false
    };

    // In a real app, you would save this to a database
    console.log('Creating new inspire post:', newPost);

    return NextResponse.json(newPost, { status: 201 });
  } catch (error) {
    console.error('Error creating inspiration post:', error);
    return NextResponse.json(
      { error: 'Failed to create inspiration post' },
      { status: 500 }
    );
  }
} 