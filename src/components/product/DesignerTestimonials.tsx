'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

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
          `/api/products/${productId}/testimonials?limit=6`
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

  // No loading skeleton — section simply doesn't exist until data arrives
  if (loading || error || testimonials.length === 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: [0.25, 0.8, 0.25, 1] }}
    >
      <h2
        className="font-headline font-light mb-6"
        style={{ fontSize: "clamp(20px, 2.5vw, 28px)", color: "var(--folio-text-primary, #1a1a1a)" }}
      >
        What Designers Are Saying
      </h2>

      <div className="space-y-3">
        {testimonials.map((testimonial) => (
          <QuoteCard key={testimonial.id} testimonial={testimonial} />
        ))}
      </div>
    </motion.section>
  );
}

function QuoteCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{
        background: "rgba(245, 239, 232, 0.6)",
        borderLeft: "2px solid #c9a96e",
      }}
    >
      {/* Quote text */}
      <blockquote
        className="font-headline italic"
        style={{
          fontSize: "15px",
          lineHeight: 1.5,
          color: "var(--folio-text-primary, #1a1a1a)",
        }}
      >
        {testimonial.isFeatured && (
          <span style={{ color: "#c9a96e", marginRight: "4px" }}>&#9733;</span>
        )}
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>

      {/* Attribution row */}
      <div className="flex items-center gap-2.5 mt-3">
        {/* Designer avatar */}
        <Link
          href={`/designer/${testimonial.designer.id}?tab=shop`}
          className="flex-shrink-0"
        >
          {testimonial.designer.profileImage ? (
            <Image
              src={testimonial.designer.profileImage}
              alt={testimonial.designer.name || 'Designer'}
              width={28}
              height={28}
              className="rounded-full object-cover"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-body"
              style={{
                backgroundColor: "rgba(201, 169, 110, 0.15)",
                color: "#8a7044",
                fontSize: "11px",
                fontWeight: 500,
              }}
            >
              {(testimonial.designer.name || 'D').charAt(0).toUpperCase()}
            </div>
          )}
        </Link>

        {/* Name + project link + shop link */}
        <div className="flex items-center gap-1.5 flex-wrap font-body" style={{ fontSize: "11px" }}>
          <Link
            href={`/designer/${testimonial.designer.id}?tab=shop`}
            className="hover:underline"
            style={{ color: "var(--folio-text-secondary, #6b6b6b)" }}
          >
            {testimonial.designer.name || 'Designer'}
          </Link>

          {testimonial.project && (
            <>
              <span style={{ color: "var(--folio-text-tertiary, #9b9b9b)" }}>&middot;</span>
              <Link
                href={`/project/${testimonial.project.id}`}
                className="hover:underline"
                style={{ color: "var(--folio-text-secondary, #6b6b6b)" }}
              >
                {testimonial.project.title} →
              </Link>
            </>
          )}

          <span style={{ color: "var(--folio-text-tertiary, #9b9b9b)" }}>&middot;</span>
          <Link
            href={`/designer/${testimonial.designer.id}?tab=shop`}
            className="hover:underline"
            style={{ color: "#8a7044" }}
          >
            View shop →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default DesignerTestimonials;
