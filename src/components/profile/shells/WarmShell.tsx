import SafeImage from "@/components/SafeImage";
import ProjectMosaic from "../ProjectMosaic";
import { ShellProps } from "./DefaultShell";

export default function WarmShell({ designer, projects, aesthetic, viewerContext }: ShellProps) {
  const heroImage = projects[0]?.heroImageUrl || projects[0]?.coverImageUrl || projects[0]?.imageUrl;

  return (
    <div className="min-h-screen bg-[#F5F0EA]">
      {/* Rounded Inset Hero */}
      {heroImage && (
        <div className="max-w-6xl mx-auto px-6 pt-12">
          <div className="relative h-[50vh] rounded-3xl overflow-hidden shadow-xl">
            <SafeImage
              src={heroImage}
              alt={`${designer.name} portfolio`}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Name & Title */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-serif font-normal mb-4">{designer.name}</h1>
          {designer.title && (
            <p className="text-xl font-serif text-[var(--text-primary)]">{designer.title}</p>
          )}
        </div>

        {/* Bio - Serif italic with decorative icon */}
        {designer.bio && (
          <div className="mb-16 text-center">
            <div className="inline-flex items-center justify-center mb-6">
              <div className="w-12 h-px bg-[var(--text-tertiary)]/30 mr-4" />
              <svg
                className="w-6 h-6 text-[var(--text-tertiary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <div className="w-12 h-px bg-[var(--text-tertiary)]/30 ml-4" />
            </div>
            <p className="text-lg font-serif italic text-[var(--text-primary)] leading-relaxed max-w-2xl mx-auto">
              {designer.bio}
            </p>
            {designer.location && (
              <p className="mt-6 text-[var(--text-secondary)] font-serif">{designer.location}</p>
            )}
          </div>
        )}

        {/* Projects Grid */}
        <div className="mt-20">
          <ProjectMosaic
            projects={projects}
            theme={aesthetic.theme}
            viewer={viewerContext}
          />
        </div>
      </div>
    </div>
  );
}


