'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaCalendarAlt, FaUser, FaShare, FaHeart, FaBookmark } from 'react-icons/fa';
import SafeImage from '../../../components/SafeImage';

interface Editorial {
  id: string;
  title: string;
  description: string;
  content: string;
  author: string;
  imageUrl: string;
  category: string;
  publishedAt: string;
  tags: string[];
  readTime: string;
  likes: number;
  views: number;
}

const EditorialDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const [editorial, setEditorial] = useState<Editorial | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    if (params?.id) {
      fetchEditorial();
    }
  }, [params?.id]);

  const fetchEditorial = async () => {
    try {
      const response = await fetch(`/api/editorials/${params?.id}`);
      if (response.ok) {
        const data = await response.json();
        setEditorial(data);
      } else {
        console.error('Editorial not found');
      }
    } catch (error) {
      console.error('Error fetching editorial:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!editorial) return;
    
    try {
      const response = await fetch(`/api/editorials/${editorial.id}/like`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setIsLiked(!isLiked);
        setEditorial(prev => prev ? {
          ...prev,
          likes: isLiked ? prev.likes - 1 : prev.likes + 1
        } : null);
      }
    } catch (error) {
      console.error('Error liking editorial:', error);
    }
  };

  const handleBookmark = async () => {
    if (!editorial) return;
    
    try {
      const response = await fetch(`/api/editorials/${editorial.id}/bookmark`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setIsBookmarked(!isBookmarked);
      }
    } catch (error) {
      console.error('Error bookmarking editorial:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pl-20 lg:pl-56">
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-folio-accent"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!editorial) {
    return (
      <div className="min-h-screen bg-gray-50 pl-20 lg:pl-56">
        <div className="p-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-folio-text mb-4">Editorial Not Found</h1>
            <p className="text-folio-text-muted mb-8">The editorial you're looking for doesn't exist or has been removed.</p>
            <button
              onClick={() => router.push('/editorials')}
              className="px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors"
            >
              Back to Editorials
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pl-20 lg:pl-56">
      <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center text-folio-text hover:text-folio-accent mr-4"
          >
            <FaArrowLeft className="mr-2" />
            Back
          </button>
        </div>

        {/* Editorial Content */}
        <div className="max-w-4xl mx-auto">
          {/* Editorial Header */}
          <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 bg-folio-accent text-white text-sm font-medium rounded-full">
                {editorial.category}
              </span>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleLike}
                  className={`p-2 rounded-full transition-colors ${
                    isLiked ? 'text-red-500 bg-red-50' : 'text-folio-text hover:text-red-500'
                  }`}
                >
                  <FaHeart className="w-5 h-5" />
                </button>
                <button
                  onClick={handleBookmark}
                  className={`p-2 rounded-full transition-colors ${
                    isBookmarked ? 'text-folio-accent bg-folio-accent bg-opacity-10' : 'text-folio-text hover:text-folio-accent'
                  }`}
                >
                  <FaBookmark className="w-5 h-5" />
                </button>
                <button className="p-2 text-folio-text hover:text-folio-accent">
                  <FaShare className="w-5 h-5" />
                </button>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-folio-text mb-4">{editorial.title}</h1>
            
            <div className="flex items-center text-folio-text-muted text-sm mb-4">
              <FaUser className="w-4 h-4 mr-2" />
              <span className="mr-4">By {editorial.author}</span>
              <FaCalendarAlt className="w-4 h-4 mr-2" />
              <span className="mr-4">{new Date(editorial.publishedAt).toLocaleDateString()}</span>
              <span>{editorial.readTime}</span>
            </div>

            <p className="text-folio-text-muted leading-relaxed mb-6">{editorial.description}</p>

            {/* Stats */}
            <div className="flex items-center text-sm text-folio-text-muted border-t border-folio-border pt-4">
              <span className="mr-6">{editorial.likes} likes</span>
              <span>{editorial.views} views</span>
            </div>
          </div>

          {/* Editorial Image */}
          <div className="mb-8">
            <SafeImage
              src={editorial.imageUrl}
              alt={editorial.title}
              width={800}
              height={400}
              className="w-full h-64 md:h-96 object-cover rounded-lg"
            />
          </div>

          {/* Editorial Content */}
          <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6 mb-6">
            <div className="prose prose-folio max-w-none">
              <div 
                className="text-folio-text leading-relaxed"
                dangerouslySetInnerHTML={{ __html: editorial.content }}
              />
            </div>
          </div>

          {/* Tags */}
          {editorial.tags && editorial.tags.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6 mb-6">
              <h2 className="text-xl font-bold text-folio-text mb-4">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {editorial.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-folio-muted text-folio-text text-sm rounded-full hover:bg-folio-accent hover:text-white transition-colors cursor-pointer"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Author Info */}
          <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6">
            <h2 className="text-xl font-bold text-folio-text mb-4">About the Author</h2>
            <div className="flex items-center">
              <div className="w-16 h-16 bg-folio-accent rounded-full flex items-center justify-center text-white font-bold text-xl mr-4">
                {editorial.author.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-folio-text">{editorial.author}</h3>
                <p className="text-folio-text-muted">Design Writer & Curator</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorialDetailPage; 