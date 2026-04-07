import SafeImage from "@/components/SafeImage";
import ProjectMosaic from "../ProjectMosaic";
import { AestheticProfile, ViewerFingerprint } from "@/lib/aesthetic/types";

export type ShellProps = {
  designer: {
    id: string;
    name: string;
    title?: string | null;
    bio?: string | null;
    profileImage?: string | null;
    location?: string | null;
  };
  projects: Array<{
    id: string;
    title: string;
    imageUrl?: string | null;
    heroImageUrl?: string | null;
    coverImageUrl?: string | null;
    saveCount?: number | null;
    viewCount?: number | null;
    isFeatured?: boolean | null;
    roomType?: string | null;
    aestheticVector?: number[];
  }>;
  aesthetic: AestheticProfile;
  viewerContext?: ViewerFingerprint | null;
};

export default function DefaultShell({ designer, projects, aesthetic, viewerContext }: ShellProps) {
  const heroImage = projects[0]?.heroImageUrl || projects[0]?.coverImageUrl || projects[0]?.imageUrl;

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Hero Section */}
      {heroImage && (
        <div className="relative h-[50vh] w-full">
          <SafeImage
            src={heroImage}
            alt={`${designer.name} portfolio`}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
            <h1 className="text-4xl font-bold mb-2">{designer.name}</h1>
            {designer.title && <p className="text-xl opacity-90">{designer.title}</p>}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Bio Section */}
        {designer.bio && (
          <div className="mb-12 max-w-3xl">
            <p className="text-lg text-folio-text-primary leading-relaxed">{designer.bio}</p>
            {designer.location && (
              <p className="mt-4 text-folio-text-secondary">{designer.location}</p>
            )}
          </div>
        )}

        {/* Projects Grid */}
        <div>
          <h2 className="text-2xl font-semibold mb-6">Projects</h2>
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


