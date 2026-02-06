'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';

interface Testimonial {
  id: string;
  quote: string;
  isFeatured: boolean;
  createdAt: string;
  designer: {
    id: string;
    name: string;
    profileImage: string | null;
    companyName: string | null;
  };
  project: {
    id: string;
    title: string;
  } | null;
}

interface DesignerTestimonialsProps {
  productId: string;
}

export function DesignerTestimonials({ productId }: DesignerTestimonialsProps) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTestimonials() {
      try {
        const response = await fetch(
          `/api/products/${productId}/testimonials?limit=10`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch testimonials');
        }
        const data = await response.json();
        setTestimonials(data.testimonials || []);
      } catch (err) {
        console.error('Error fetching testimonials:', err);
        setError('Failed to load testimonials');
      } finally {
        setLoading(false);
      }
    }

    fetchTestimonials();
  }, [productId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-semibold mb-4">What Designers Are Saying</h2>
        <div className="animate-pulse space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-[var(--bg-elevated)] rounded w-3/4" />
              <div className="h-4 bg-[var(--bg-elevated)] rounded w-1/2" />
              <div className="flex items-center gap-2 mt-3">
                <div className="w-8 h-8 bg-[var(--bg-elevated)] rounded-full" />
                <div className="h-3 bg-[var(--bg-elevated)] rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || testimonials.length === 0) {
    return null; // Don't show section if no testimonials
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold" style={{ color: '#2C2825' }}>
          What Designers Are Saying
        </h2>
        <span className="text-sm" style={{ color: '#8B8178' }}>
          {testimonials.length} testimonial{testimonials.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Masonry-style grid: 1 column mobile, 2 columns desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {testimonials.map((testimonial) => (
          <TestimonialCard key={testimonial.id} testimonial={testimonial} />
        ))}
      </div>
    </div>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div
      className="relative rounded-xl p-5 border transition-shadow hover:shadow-md"
      style={{
        backgroundColor: '#FAF9F7',
        borderColor: '#E8E4DF',
      }}
    >
      {/* Featured badge */}
      {testimonial.isFeatured && (
        <div
          className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
        >
          <Star className="w-3 h-3 fill-current" />
          <span>Featured</span>
        </div>
      )}

      {/* Quote */}
      <blockquote
        className="text-base leading-relaxed italic mb-4"
        style={{ color: '#2C2825' }}
      >
        <span
          className="text-3xl font-serif leading-none mr-1"
          style={{ color: '#C4BEB5' }}
        >
          "
        </span>
        {testimonial.quote}
        <span
          className="text-3xl font-serif leading-none ml-1"
          style={{ color: '#C4BEB5' }}
        >
          "
        </span>
      </blockquote>

      {/* Designer info */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <Link
          href={`/designer/${testimonial.designer.id}?tab=shop`}
          className="flex-shrink-0"
        >
          {testimonial.designer.profileImage ? (
            <Image
              src={testimonial.designer.profileImage}
              alt={testimonial.designer.name || 'Designer'}
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium"
              style={{ backgroundColor: '#E8E4DF', color: '#8B8178' }}
            >
              {(testimonial.designer.name || 'D').charAt(0).toUpperCase()}
            </div>
          )}
        </Link>

        {/* Name and link to shop */}
        <div className="min-w-0 flex-1">
          <Link
            href={`/designer/${testimonial.designer.id}?tab=shop`}
            className="font-medium text-sm hover:underline block truncate"
            style={{ color: '#2C2825' }}
          >
            {testimonial.designer.name || 'Anonymous Designer'}
          </Link>
          {testimonial.designer.companyName && (
            <p
              className="text-xs truncate"
              style={{ color: '#8B8178' }}
            >
              {testimonial.designer.companyName}
            </p>
          )}
          {testimonial.project && (
            <Link
              href={`/project/${testimonial.project.id}`}
              className="text-xs hover:underline block truncate"
              style={{ color: '#A9A29A' }}
            >
              from {testimonial.project.title}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default DesignerTestimonials;
