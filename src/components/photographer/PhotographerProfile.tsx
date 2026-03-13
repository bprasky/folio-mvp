"use client";

import Image from "next/image";
import { PhotographerPortfolio } from "./PhotographerPortfolio";

interface Photographer {
  id: string;
  name: string;
  bio: string | null;
  profileImage: string | null;
  location: string | null;
  website: string | null;
  instagram: string | null;
  photographyStyles: string[];
  travelRadius: string | null;
  bookingEmail: string | null;
  bookingUrl: string | null;
  views: number;
}

interface CreditedProject {
  id: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  projectId: string;
  projectTitle: string;
  projectDescription: string | null;
  designerName: string | null;
  heroImageUrl: string | null;
}

interface PhotographerProfileProps {
  photographer: Photographer;
  projects: CreditedProject[];
}

export function PhotographerProfile({ photographer, projects }: PhotographerProfileProps) {
  const handleHireClick = () => {
    // Track the click via analytics
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "photographer.hire_click",
        payload: { photographerId: photographer.id },
      }),
    }).catch(() => {});
  };

  const hireHref = photographer.bookingUrl
    || (photographer.bookingEmail ? `mailto:${photographer.bookingEmail}` : null);

  return (
    <main className="min-h-screen bg-[#fdfbf8]">
      {/* Profile Header */}
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        <div className="text-center space-y-6">
          {/* Profile Image */}
          {photographer.profileImage && (
            <div className="w-28 h-28 rounded-full overflow-hidden mx-auto border-2 border-white shadow-lg">
              <Image
                src={photographer.profileImage}
                alt={photographer.name}
                width={112}
                height={112}
                className="object-cover w-full h-full"
              />
            </div>
          )}

          {/* Name — Cormorant Garamond Italic per spec */}
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-stone-900 font-light italic tracking-tight">
            {photographer.name}
          </h1>

          {/* Location + Styles tagline */}
          <div className="text-stone-500 text-sm md:text-base font-light">
            {[
              photographer.location,
              photographer.photographyStyles.length > 0
                ? photographer.photographyStyles.map(s => capitalize(s)).join(" + ")
                : null,
            ]
              .filter(Boolean)
              .join(" \u00B7 ")}
          </div>

          {/* CTA buttons */}
          <div className="flex items-center justify-center gap-3 pt-2">
            {hireHref && (
              <a
                href={hireHref}
                target={photographer.bookingUrl ? "_blank" : undefined}
                rel={photographer.bookingUrl ? "noopener noreferrer" : undefined}
                onClick={handleHireClick}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#c17f59] text-white text-sm font-medium rounded-full hover:bg-[#a96b47] transition-colors shadow-sm"
              >
                Hire Me
              </a>
            )}
            {photographer.instagram && (
              <a
                href={`https://instagram.com/${photographer.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-stone-300 text-stone-600 text-sm rounded-full hover:border-stone-400 hover:text-stone-800 transition-colors"
              >
                Instagram
              </a>
            )}
            {photographer.website && (
              <a
                href={photographer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-stone-300 text-stone-600 text-sm rounded-full hover:border-stone-400 hover:text-stone-800 transition-colors"
              >
                Website
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="h-px bg-stone-200" />
      </div>

      {/* About Section */}
      {(photographer.bio || photographer.photographyStyles.length > 0 || photographer.travelRadius) && (
        <div className="max-w-3xl mx-auto px-6 py-12">
          {photographer.bio && (
            <div className="mb-8">
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
                About
              </h2>
              <p className="text-stone-600 leading-relaxed font-light">
                {photographer.bio}
              </p>
            </div>
          )}

          {/* Styles pills */}
          {photographer.photographyStyles.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
                Styles
              </h2>
              <div className="flex flex-wrap gap-2">
                {photographer.photographyStyles.map((style) => (
                  <span
                    key={style}
                    className="px-3 py-1 bg-stone-100 text-stone-600 text-sm rounded-full"
                  >
                    {capitalize(style)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Travel radius */}
          {photographer.travelRadius && (
            <div>
              <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
                Travel
              </h2>
              <p className="text-stone-600 font-light">{photographer.travelRadius}</p>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      {projects.length > 0 && (
        <div className="max-w-5xl mx-auto px-6">
          <div className="h-px bg-stone-200" />
        </div>
      )}

      {/* Portfolio Grid */}
      {projects.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest">
              Portfolio
            </h2>
            <span className="text-xs text-stone-400">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </span>
          </div>
          <PhotographerPortfolio projects={projects} />
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="text-stone-400 font-light">
            No published projects yet. Projects will appear here as designers credit {photographer.name} on their work.
          </p>
        </div>
      )}
    </main>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
