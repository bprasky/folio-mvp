'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FaSearch, FaChevronLeft, FaChevronRight, FaTimes, FaPlay } from 'react-icons/fa';
import { Card } from '../data/mockData';


// Components
const EditorialCard = ({ image, title, author, cta }: { image: string; title: string; author: string; cta: string }) => (
  <div className="editorial-card relative rounded-xl overflow-hidden h-[34rem] bg-white shadow-sm border border-folio-border">
    <Image src={image} alt={title} fill priority sizes="100vw" className="object-cover" />
    <div className="editorial-fade-left"></div>
    <div className="editorial-fade-right"></div>
    <button className="editorial-arrow left">
      <FaChevronLeft />
    </button>
    <button className="editorial-arrow right">
      <FaChevronRight />
    </button>
    <div className="card-overlay" style={{ position: 'static', padding: '0.75rem', width: '100%' }}>
      <div className="card-title" style={{ fontSize: '1.35rem' }}>{title}</div>
      <div className="card-author" style={{ fontSize: '1rem' }}>By {author}</div>
      <button className="inline-block mt-2 px-4 py-1 bg-folio-text text-white font-medium rounded-lg shadow hover:bg-folio-accent transition" style={{ fontSize: '1rem' }}>{cta}</button>
    </div>
  </div>
);

const MoodboardCard = ({ image, title, author }: { image: string; title: string; author: string }) => (
  <div className="relative rounded-xl bg-white shadow-sm overflow-hidden h-56 border border-folio-border">
    <Image src={image} alt={title} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover" />
    <div className="card-overlay">
      <div className="card-title">{title}</div>
      <div className="card-author">By {author}</div>
    </div>
  </div>
);

const ProductCard = ({ image, name, brand, price, cta }: { image: string; name: string; brand: string; price: string; cta: string }) => (
  <div className="relative rounded-xl bg-white shadow-sm overflow-hidden h-56 border border-folio-border">
    <Image src={image} alt={name} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover" />
    <div className="card-overlay">
      <div className="card-title">{name}</div>
      <div className="card-author">By {brand}</div>
      <div className="card-price text-folio-accent">{price}</div>
      <button className="inline-block mt-2 px-3 py-1 bg-folio-accent text-white font-medium rounded-lg hover:bg-folio-text transition" style={{ fontSize: '0.9rem' }}>{cta}</button>
    </div>
  </div>
);

const DesignerCard = ({ image, name, specialty, cta }: { image: string; name: string; specialty: string; cta: string }) => (
  <div className="relative rounded-xl bg-white shadow-sm overflow-hidden h-56 flex flex-col items-center justify-end border border-folio-border">
    <Image src={image} alt={name} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover opacity-60" />
    <div className="card-overlay" style={{ position: 'static', padding: '0.75rem', width: '100%' }}>
      <div className="card-title text-center">{name}</div>
      <div className="card-specialty text-center">{specialty}</div>
      <button className="inline-block mt-2 px-4 py-1 bg-folio-accent text-white font-medium rounded-lg hover:bg-folio-text transition" style={{ fontSize: '0.9rem' }}>{cta}</button>
    </div>
  </div>
);

const VideoCard = ({ image, title, author, eventTitle, subEventTitle }: { 
  image: string; 
  title: string; 
  author: string; 
  eventTitle: string;
  subEventTitle: string;
}) => (
  <div className="relative rounded-xl bg-white shadow-sm overflow-hidden h-56 border border-folio-border">
    <Image src={image} alt={title} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover" />
    <div className="absolute inset-0 bg-black bg-opacity-20"></div>
    <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-2">
      <FaPlay className="w-4 h-4 text-white" />
    </div>
    <div className="card-overlay">
      <div className="card-title">{title}</div>
      <div className="card-author">By {author}</div>
      <div className="text-xs text-gray-300 mt-1">
        {eventTitle} • {subEventTitle}
      </div>
    </div>
  </div>
);

const SubEventPostCard = ({ image, title, author, eventTitle, subEventTitle, tags }: { 
  image: string; 
  title: string; 
  author: string; 
  eventTitle: string;
  subEventTitle: string;
  tags?: string[];
}) => (
  <div className="relative rounded-xl bg-white shadow-sm overflow-hidden h-56 border border-folio-border">
    <Image src={image} alt={title} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover" />
    <div className="card-overlay">
      <div className="card-title">{title}</div>
      <div className="card-author">By {author}</div>
      <div className="text-xs text-gray-300 mt-1">
        {eventTitle} • {subEventTitle}
      </div>
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="px-2 py-1 bg-white bg-opacity-20 text-white text-xs rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  </div>
);

export default function FeedPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editorialIndex, setEditorialIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [feedItems, setFeedItems] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load feed data from API
  useEffect(() => {
    const loadFeedData = async () => {
      try {
        const response = await fetch('/api/feed');
        const data = await response.json();
        setFeedItems(data.items || []);
      } catch (error) {
        console.error('Failed to load feed data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFeedData();
  }, []);

  const handleCardClick = (card: Card) => {
    switch (card.type) {
      case 'editorial':
      case 'moodboard':
        // Navigate to project detail page
        if (card.projectId) {
          router.push(`/project/${card.projectId}`);
        }
        break;
      case 'product':
        // Navigate to product detail page
        if (card.productId) {
          router.push(`/product/${card.productId}`);
        }
        break;
      case 'designer':
        // Navigate to designer profile page
        if (card.designerId) {
          router.push(`/designer/profile?user=${card.designerId}`);
        }
        break;
      case 'video':
      case 'subEventPost':
        // Navigate to subevent page
        if (card.subEventId) {
          router.push(`/subevents/${card.subEventId}`);
        }
        break;
      default:
        // Show modal for other types
        setSelectedCard(card);
        setShowModal(true);
    }
  };

  const filteredCards = feedItems.filter(card => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (card.name && card.name.toLowerCase().includes(query)) ||
      (card.title && card.title.toLowerCase().includes(query)) ||
      (card.brand && card.brand.toLowerCase().includes(query)) ||
      (card.author && card.author.toLowerCase().includes(query)) ||
      (card.specialty && card.specialty.toLowerCase().includes(query)) ||
      (card.eventTitle && card.eventTitle.toLowerCase().includes(query)) ||
      (card.subEventTitle && card.subEventTitle.toLowerCase().includes(query)) ||
      (card.tags && card.tags.some(tag => tag.toLowerCase().includes(query)))
    );
  });

  const renderCard = (card: Card) => {
    switch (card.type) {
      case 'editorial':
        return <EditorialCard image={card.image} title={card.title!} author={card.author!} cta="Read More" />;
      case 'moodboard':
        return <MoodboardCard image={card.image} title={card.title!} author={card.author!} />;
      case 'product':
        return <ProductCard image={card.image} name={card.name!} brand={card.brand!} price={card.price!} cta="Shop Now" />;
      case 'designer':
        return <DesignerCard image={card.image} name={card.name!} specialty={card.specialty!} cta="View Profile" />;
      case 'video':
        return <VideoCard image={card.image} title={card.title!} author={card.author!} eventTitle={card.eventTitle!} subEventTitle={card.subEventTitle!} />;
      case 'subEventPost':
        return <SubEventPostCard image={card.image} title={card.title!} author={card.author!} eventTitle={card.eventTitle!} subEventTitle={card.subEventTitle!} tags={card.tags} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-folio-background">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-folio-background">
        {/* Top Bar with Search */}
        <div className="w-full flex items-center justify-end mt-4 px-4">
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white border border-folio-border text-folio-text placeholder-folio-border focus:outline-none focus:ring-1 focus:ring-folio-accent focus:border-folio-accent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-folio-border">
              <FaSearch />
            </span>
          </div>
        </div>

        {/* Pinned Editorial Feature */}
        <div className="w-full mt-6 mb-2 px-4">
          {feedItems.filter(card => card.type === 'editorial')[editorialIndex] && (
            <EditorialCard
              image={feedItems.filter(card => card.type === 'editorial')[editorialIndex].image}
              title={feedItems.filter(card => card.type === 'editorial')[editorialIndex].title!}
              author={feedItems.filter(card => card.type === 'editorial')[editorialIndex].author!}
              cta="Read More"
            />
          )}
        </div>

        {/* Filter Controls */}
        <div className="w-full flex items-center justify-between mt-2 mb-4 px-4">
          <div className="relative">
            <button className="flex items-center bg-white border border-folio-border text-folio-text px-4 py-2 rounded-lg font-medium min-w-[120px] opacity-60 cursor-not-allowed">
              <span>For You</span>
              <FaChevronLeft className="ml-2 text-xs" />
            </button>
          </div>
          <div className="flex-1 flex justify-center gap-6">
            <button className="feed-subtab px-4 py-2 font-medium text-folio-text rounded-lg opacity-60 cursor-not-allowed">All</button>
            <button className="feed-subtab px-4 py-2 font-medium text-folio-text rounded-lg opacity-60 cursor-not-allowed">Projects</button>
            <button className="feed-subtab px-4 py-2 font-medium text-folio-text rounded-lg opacity-60 cursor-not-allowed">Products</button>
          </div>
          <div className="w-[120px]"></div>
        </div>

        {/* Feed Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 pb-8">
          {loading ? (
            <div className="col-span-full flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-folio-accent"></div>
            </div>
          ) : (
            filteredCards.map((card, index) => (
              <div
                key={card.id}
                className={`card-clickable cursor-pointer ${card.size === '2x1' ? 'col-span-2' : ''}`}
                onClick={() => handleCardClick(card)}
              >
                {renderCard(card)}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-folio-text bg-opacity-80 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl flex flex-col md:flex-row max-w-3xl w-full mx-4 relative border border-folio-border">
            <button
              className="absolute top-3 right-3 text-white text-2xl bg-folio-text bg-opacity-80 rounded-full w-10 h-10 flex items-center justify-center z-10 hover:bg-opacity-100 transition"
              onClick={() => setShowModal(false)}
            >
              <FaTimes />
            </button>
            <div className="md:w-1/2 w-full flex items-center justify-center p-4">
              <Image
                src={selectedCard.image}
                alt={selectedCard.title || selectedCard.name || ''}
                width={400}
                height={400}
                className="max-h-96 w-full object-contain rounded-lg"
              />
            </div>
            <div className="md:w-1/2 w-full flex flex-col justify-center p-6">
              <h2 className="text-lg font-semibold mb-2 text-folio-text">{selectedCard.title || selectedCard.name}</h2>
              <p className="text-sm text-folio-border mb-4">
                {selectedCard.author ? `By ${selectedCard.author}` : selectedCard.brand ? `By ${selectedCard.brand}` : ''}
              </p>
              <p className="text-base text-folio-text">
                {selectedCard.type === 'editorial' && 'This is a featured editorial post. Discover the story behind the design.'}
                {selectedCard.type === 'moodboard' && 'A curated moodboard for inspiration.'}
                {selectedCard.type === 'product' && 'Explore this product and see how it fits in modern interiors.'}
                {selectedCard.type === 'designer' && 'Meet the designer and view their portfolio.'}
                {selectedCard.type === 'video' && `Watch this video from ${selectedCard.eventTitle} - ${selectedCard.subEventTitle}.`}
                {selectedCard.type === 'subEventPost' && `View this post from ${selectedCard.eventTitle} - ${selectedCard.subEventTitle}.`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 