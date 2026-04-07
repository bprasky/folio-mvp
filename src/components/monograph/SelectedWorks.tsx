import Image from 'next/image';
import Link from 'next/link';

interface Project {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  images: Array<{
    id: string;
    url: string;
    projectId: string;
  }> | null;
}

interface SelectedWorksProps {
  projects: Project[];
}

/**
 * Fibonacci-inspired masonry grid pattern
 * Creates deliberate, editorial spacing with varying card sizes
 */
function getFibonacciSpan(index: number): string {
  const patterns = [
    'col-span-4 md:col-span-6 row-span-3', // Large hero
    'col-span-2 md:col-span-3 row-span-2', // Medium
    'col-span-2 md:col-span-3 row-span-2', // Medium
    'col-span-2 md:col-span-2 row-span-1', // Small
    'col-span-2 md:col-span-2 row-span-1', // Small
    'col-span-4 md:col-span-4 row-span-2', // Wide
    'col-span-2 md:col-span-2 row-span-2', // Tall
    'col-span-2 md:col-span-2 row-span-1', // Small
  ];
  return patterns[index % patterns.length];
}

export default function SelectedWorks({ projects }: SelectedWorksProps) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-12 text-center">
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-folio-text-primary font-light mb-4">
          Selected Works
        </h2>
        <p className="text-folio-text-secondary text-sm md:text-base font-light">
          A curated selection of published projects
        </p>
      </div>

      {/* Fibonacci Masonry Grid */}
      <div className="grid grid-cols-4 md:grid-cols-6 gap-4 md:gap-6 auto-rows-[200px]">
        {projects.map((project, index) => {
          const imageUrl = project.images?.[0]?.url || '/images/placeholders/project-16x9.jpg';
          const year = project.publishedAt 
            ? new Date(project.publishedAt).getFullYear()
            : new Date(project.createdAt).getFullYear();
          const caption = project.description || project.category || 'Interior Design';

          return (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className={`group relative overflow-hidden rounded-lg bg-surface-elevated ${getFibonacciSpan(index)}`}
            >
              <Image
                src={imageUrl}
                alt={project.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 33vw"
              />
              
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* Project Info */}
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                <h3 className="font-serif text-xl md:text-2xl text-white font-light mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {project.title}
                </h3>
                <div className="flex items-center justify-between text-white/90 text-sm font-light opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span>{year}</span>
                  <span className="text-white/70">{caption.slice(0, 30)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
