import Image from "next/image";
import Link from "next/link";

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

interface PhotographerPortfolioProps {
  projects: CreditedProject[];
}

export function PhotographerPortfolio({ projects }: PhotographerPortfolioProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/p/${project.slug}`}
          className="group relative aspect-[4/3] overflow-hidden rounded-[20px] bg-stone-100"
        >
          {project.heroImageUrl ? (
            <Image
              src={project.heroImageUrl}
              alt={project.projectTitle}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-300">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Project info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-serif text-lg text-white font-light opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {project.projectTitle}
            </h3>
            {project.designerName && (
              <p className="text-white/80 text-xs font-light mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {project.designerName}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
