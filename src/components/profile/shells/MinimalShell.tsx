import SafeImage from "@/components/SafeImage";
import ProjectMosaic from "../ProjectMosaic";
import { ShellProps } from "./DefaultShell";

export default function MinimalShell({ designer, projects, aesthetic, viewerContext }: ShellProps) {
  const heroImage = projects[0]?.heroImageUrl || projects[0]?.coverImageUrl || projects[0]?.imageUrl;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - 70vh full bleed */}
      {heroImage && (
        <div className="relative h-[70vh] w-full">
          <SafeImage
            src={heroImage}
            alt={`${designer.name} portfolio`}
            fill
            className="object-cover"
          />
        </div>
      )}

      {/* Content - Centered with lots of whitespace */}
      <div className="max-w-4xl mx-auto px-6 py-24">
        {/* Name & Title - Centered */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-light tracking-wide mb-4">{designer.name}</h1>
          {designer.title && (
            <p className="text-xl font-light tracking-wide text-gray-600">{designer.title}</p>
          )}
        </div>

        {/* Bio - Centered, light tracking */}
        {designer.bio && (
          <div className="mb-20 text-center">
            <p className="text-lg font-light tracking-wide text-gray-700 leading-relaxed max-w-2xl mx-auto">
              {designer.bio}
            </p>
            {designer.location && (
              <p className="mt-6 text-gray-500 font-light tracking-wide">{designer.location}</p>
            )}
          </div>
        )}

        {/* Projects Grid */}
        <div className="mt-32">
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


