'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaMapMarkerAlt, FaEnvelope, FaPhone, FaGlobe, FaInstagram, FaLinkedin, FaStar, FaHeart, FaShare } from 'react-icons/fa';
import SafeImage from '../../../components/SafeImage';
import Link from 'next/link';

interface Designer {
  id: string;
  name: string;
  title: string;
  bio: string;
  location: string;
  email: string;
  phone?: string;
  website?: string;
  instagram?: string;
  linkedin?: string;
  profileImage?: string;
  coverImage?: string;
  specialties: string[];
  rating: number;
  reviewCount: number;
  projectCount: number;
  yearsExperience: number;
  priceRange: string;
  availability: 'available' | 'busy' | 'unavailable';
  portfolio: PortfolioItem[];
  reviews: Review[];
  certifications: string[];
  awards: string[];
}

interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  year: number;
  tags: string[];
}

interface Review {
  id: string;
  clientName: string;
  rating: number;
  comment: string;
  date: string;
  projectType: string;
}

const DesignerDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const [designer, setDesigner] = useState<Designer | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'reviews' | 'about'>('portfolio');
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (params?.id) {
      fetchDesigner();
    }
  }, [params?.id]);

  const fetchDesigner = async () => {
    try {
      const response = await fetch(`/api/designers/${params?.id}`);
      if (response.ok) {
        const data = await response.json();
        setDesigner(data);
      } else {
        console.error('Designer not found');
      }
    } catch (error) {
      console.error('Error fetching designer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!designer) return;
    
    try {
      const response = await fetch(`/api/designers/${designer.id}/follow`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setIsFollowing(!isFollowing);
      }
    } catch (error) {
      console.error('Error following designer:', error);
    }
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'unavailable': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <FaStar
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
      />
    ));
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

  if (!designer) {
    return (
      <div className="min-h-screen bg-gray-50 pl-20 lg:pl-56">
        <div className="p-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-folio-text mb-4">Designer Not Found</h1>
            <p className="text-folio-text-muted mb-8">The designer you're looking for doesn't exist or has been removed.</p>
            <button
              onClick={() => router.push('/designers')}
              className="px-6 py-3 bg-folio-accent text-white rounded-lg hover:bg-folio-accent-dark transition-colors"
            >
              Back to Designers
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

        {/* Designer Profile */}
        <div className="max-w-6xl mx-auto">
          {/* Cover Image */}
          {designer.coverImage && (
            <div className="mb-8">
              <SafeImage
                src={designer.coverImage}
                alt={`${designer.name} cover`}
                width={1200}
                height={400}
                className="w-full h-48 md:h-64 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Profile Header */}
          <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="flex items-center mb-4 md:mb-0">
                <div className="w-20 h-20 bg-folio-accent rounded-full flex items-center justify-center text-white font-bold text-2xl mr-6">
                  {designer.profileImage ? (
                    <SafeImage
                      src={designer.profileImage}
                      alt={designer.name}
                      width={80}
                      height={80}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    designer.name.charAt(0)
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-folio-text mb-1">{designer.name}</h1>
                  <p className="text-folio-text-muted mb-2">{designer.title}</p>
                  <div className="flex items-center text-sm text-folio-text-muted">
                    <FaMapMarkerAlt className="w-4 h-4 mr-1" />
                    <span className="mr-4">{designer.location}</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAvailabilityColor(designer.availability)}`}>
                      {designer.availability}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleFollow}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isFollowing
                      ? 'bg-folio-muted text-folio-text hover:bg-gray-300'
                      : 'bg-folio-accent text-white hover:bg-folio-accent-dark'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button className="p-2 text-folio-text hover:text-folio-accent">
                  <FaHeart className="w-5 h-5" />
                </button>
                <button className="p-2 text-folio-text hover:text-folio-accent">
                  <FaShare className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-folio-border">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  {renderStars(designer.rating)}
                </div>
                <p className="text-2xl font-bold text-folio-text">{designer.rating}</p>
                <p className="text-sm text-folio-text-muted">{designer.reviewCount} reviews</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-folio-text">{designer.projectCount}</p>
                <p className="text-sm text-folio-text-muted">Projects</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-folio-text">{designer.yearsExperience}</p>
                <p className="text-sm text-folio-text-muted">Years Experience</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-folio-text">{designer.priceRange}</p>
                <p className="text-sm text-folio-text-muted">Price Range</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 mb-6">
            {[
              { key: 'portfolio', label: 'Portfolio' },
              { key: 'reviews', label: 'Reviews' },
              { key: 'about', label: 'About' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.key
                    ? 'bg-folio-accent text-white'
                    : 'bg-white text-folio-text hover:bg-folio-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow-sm border border-folio-border p-6">
            {activeTab === 'portfolio' && (
              <div>
                <h2 className="text-xl font-bold text-folio-text mb-6">Portfolio</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {designer.portfolio.map((item) => (
                    <div key={item.id} className="group cursor-pointer">
                      <div className="mb-4 overflow-hidden rounded-lg">
                        <SafeImage
                          src={item.imageUrl}
                          alt={item.title}
                          width={400}
                          height={300}
                          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <h3 className="font-semibold text-folio-text mb-2">{item.title}</h3>
                      <p className="text-folio-text-muted text-sm mb-2">{item.description}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-folio-text-muted">{item.year}</span>
                        <span className="px-2 py-1 bg-folio-muted text-folio-text text-xs rounded-full">
                          {item.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                <h2 className="text-xl font-bold text-folio-text mb-6">Client Reviews</h2>
                <div className="space-y-4">
                  {designer.reviews.map((review) => (
                    <div key={review.id} className="border-b border-folio-border pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-folio-accent rounded-full flex items-center justify-center text-white font-bold mr-3">
                            {review.clientName.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-folio-text">{review.clientName}</h4>
                            <p className="text-sm text-folio-text-muted">{review.projectType}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {renderStars(review.rating)}
                          <span className="text-sm text-folio-text-muted ml-2">
                            {new Date(review.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-folio-text leading-relaxed">{review.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div>
                <h2 className="text-xl font-bold text-folio-text mb-6">About {designer.name}</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-folio-text mb-2">Bio</h3>
                    <p className="text-folio-text leading-relaxed">{designer.bio}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-folio-text mb-2">Specialties</h3>
                    <div className="flex flex-wrap gap-2">
                      {designer.specialties.map((specialty, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-folio-muted text-folio-text text-sm rounded-full"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-folio-text mb-2">Contact Information</h3>
                    <div className="space-y-2">
                      <div className="flex items-center text-folio-text">
                        <FaEnvelope className="w-4 h-4 mr-2" />
                        <a href={`mailto:${designer.email}`} className="hover:text-folio-accent">
                          {designer.email}
                        </a>
                      </div>
                      {designer.phone && (
                        <div className="flex items-center text-folio-text">
                          <FaPhone className="w-4 h-4 mr-2" />
                          <a href={`tel:${designer.phone}`} className="hover:text-folio-accent">
                            {designer.phone}
                          </a>
                        </div>
                      )}
                      {designer.website && (
                        <div className="flex items-center text-folio-text">
                          <FaGlobe className="w-4 h-4 mr-2" />
                          <a href={designer.website} target="_blank" rel="noopener noreferrer" className="hover:text-folio-accent">
                            {designer.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-folio-text mb-2">Social Media</h3>
                    <div className="flex space-x-4">
                      {designer.instagram && (
                        <a href={designer.instagram} target="_blank" rel="noopener noreferrer" className="text-folio-text hover:text-folio-accent">
                          <FaInstagram className="w-5 h-5" />
                        </a>
                      )}
                      {designer.linkedin && (
                        <a href={designer.linkedin} target="_blank" rel="noopener noreferrer" className="text-folio-text hover:text-folio-accent">
                          <FaLinkedin className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignerDetailPage; 