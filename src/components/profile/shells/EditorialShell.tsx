import SafeImage from "@/components/SafeImage";
import ProjectMosaic from "../ProjectMosaic";
import { ShellProps } from "./DefaultShell";

export default function EditorialShell({ designer, projects, aesthetic, viewerContext }: ShellProps) {
  const heroImage = projects[0]?.heroImageUrl || projects[0]?.coverImageUrl || projects[0]?.imageUrl;

  return (
    <div className="min-h-screen bg-white">
      {/* Asymmetric Grid Split */}
      <div className="grid grid-cols-12 gap-0">
        {/* Left: Hero Image */}
        <div className="col-span-12 lg:col-span-7 relative h-[60vh] lg:h-screen">
          {heroImage && (
            <SafeImage
              src={heroImage}
              alt={`${designer.name} portfolio`}
              fill
              className="object-cover"
            />
          )}
        </div>

        {/* Right: Bio Content */}
        <div className="col-span-12 lg:col-span-5 flex items-center p-12 lg:p-16">
          <div>
            <h1 className="text-4xl lg:text-5xl font-serif font-medium tracking-tight mb-6">
              {designer.name}
            </h1>
            {designer.title && (
              <p className="text-xl font-serif text-folio-text-secondary mb-8">{designer.title}</p>
            )}
            {designer.bio && (
              <div className="border-t border-folio-border-subtle pt-8">
                <p className="text-base font-serif leading-relaxed text-folio-text-primary">
                  {designer.bio}
                </p>
                {designer.location && (
                  <p className="mt-4 text-sm text-folio-text-secondary">{designer.location}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="border-t border-folio-border-subtle pt-12">
          <h2 className="text-3xl font-serif font-medium tracking-tight mb-12">
            Selected Work
          </h2>
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


