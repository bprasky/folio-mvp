import SafeImage from "@/components/SafeImage";
import ProjectMosaic from "../ProjectMosaic";
import { ShellProps } from "./DefaultShell";

export default function MoodyShell({ designer, projects, aesthetic, viewerContext }: ShellProps) {
  const heroImage = projects[0]?.heroImageUrl || projects[0]?.coverImageUrl || projects[0]?.imageUrl;

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Full Bleed Dark Hero */}
      {heroImage && (
        <div className="relative h-[60vh] w-full">
          <SafeImage
            src={heroImage}
            alt={`${designer.name} portfolio`}
            fill
            className="object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-12">
            <h1 className="text-5xl font-medium text-gray-100 mb-3">{designer.name}</h1>
            {designer.title && (
              <p className="text-xl text-gray-400">{designer.title}</p>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Bio - Muted text colors */}
        {designer.bio && (
          <div className="mb-16">
            <p className="text-lg text-gray-300 leading-relaxed mb-6">{designer.bio}</p>
            {designer.location && (
              <p className="text-gray-500">{designer.location}</p>
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


