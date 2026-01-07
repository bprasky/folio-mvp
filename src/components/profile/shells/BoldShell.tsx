import SafeImage from "@/components/SafeImage";
import ProjectMosaic from "../ProjectMosaic";
import { ShellProps } from "./DefaultShell";

export default function BoldShell({ designer, projects, aesthetic, viewerContext }: ShellProps) {
  const heroImage = projects[0]?.heroImageUrl || projects[0]?.coverImageUrl || projects[0]?.imageUrl;

  return (
    <div className="min-h-screen bg-white">
      {/* Centered Hero with Text Overlay */}
      {heroImage && (
        <div className="relative h-[65vh] w-full">
          <SafeImage
            src={heroImage}
            alt={`${designer.name} portfolio`}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="text-6xl lg:text-7xl font-bold mb-4 tracking-tight">
                {designer.name}
              </h1>
              {designer.title && (
                <p className="text-2xl font-bold uppercase tracking-wider opacity-90">
                  {designer.title}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content - High Contrast Sections */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Bio Section */}
        {designer.bio && (
          <div className="mb-20 border-t-4 border-black pt-12">
            <p className="text-xl font-bold leading-relaxed text-gray-900 max-w-3xl">
              {designer.bio}
            </p>
            {designer.location && (
              <p className="mt-6 text-lg font-semibold text-gray-700">{designer.location}</p>
            )}
          </div>
        )}

        {/* Projects Grid */}
        <div className="mt-24 border-t-4 border-black pt-12">
          <h2 className="text-4xl font-bold uppercase mb-12 tracking-tight">Projects</h2>
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


