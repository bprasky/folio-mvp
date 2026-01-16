"use client";
import Link from "next/link";
import { useMemo } from "react";
import clsx from "clsx";
import SafeImage from "@/components/SafeImage";
import { AestheticTheme, ViewerFingerprint } from "@/lib/aesthetic/types";

type UIProject = {
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
};

export type ProjectMosaicProps = {
  projects: UIProject[];
  theme: AestheticTheme;
  viewer?: ViewerFingerprint | null;
  canEdit?: boolean;
};

type Size = "L" | "M" | "S";

type ThemeConfig = {
  containerClass: string;
  cardClass: string;
  overlayClass: string;
  gapClass: string;
  roundingClass: string;
  titleClasses: {
    L: string;
    M: string;
    S: string;
  };
  metaClass: string;
};

const themeConfigs: Record<AestheticTheme, ThemeConfig> = {
  minimal: {
    containerClass: "auto-rows-[10px]",
    cardClass: "bg-[var(--bg-base)] border-0 shadow-none hover:shadow-md transition-shadow duration-500",
    overlayClass: "bg-gradient-to-t from-black/40 via-transparent to-transparent",
    gapClass: "gap-6",
    roundingClass: "rounded-none",
    titleClasses: {
      L: "text-2xl font-light tracking-wide",
      M: "text-lg font-light tracking-wide",
      S: "text-sm font-light tracking-wide",
    },
    metaClass: "text-white/70 text-[11px]",
  },
  editorial: {
    containerClass: "auto-rows-[10px]",
    cardClass: "bg-[var(--bg-base)] border border-[var(--ridge-outer)] shadow-sm hover:shadow-lg transition-all duration-300",
    overlayClass: "bg-gradient-to-t from-black/70 via-black/20 to-transparent",
    gapClass: "gap-4",
    roundingClass: "rounded-sm",
    titleClasses: {
      L: "text-2xl font-serif font-medium tracking-tight",
      M: "text-lg font-serif font-medium tracking-tight",
      S: "text-sm font-serif font-medium tracking-tight",
    },
    metaClass: "text-white/80 text-[11px] font-medium",
  },
  warm: {
    containerClass: "auto-rows-[10px]",
    cardClass: "bg-[#F5F0EA] border-0 shadow-sm hover:shadow-xl transition-shadow duration-500",
    overlayClass: "bg-gradient-to-t from-black/50 via-transparent to-transparent",
    gapClass: "gap-5",
    roundingClass: "rounded-2xl",
    titleClasses: {
      L: "text-2xl font-serif italic font-normal tracking-wide",
      M: "text-lg font-serif italic font-normal tracking-wide",
      S: "text-sm font-serif italic font-normal tracking-wide",
    },
    metaClass: "text-white/85 text-[11px]",
  },
  moody: {
    containerClass: "auto-rows-[10px]",
    cardClass: "bg-[var(--bg-base)] border border-[var(--ridge-outer)] shadow-lg hover:border-[var(--ridge-outer)] transition-all duration-300",
    overlayClass: "bg-gradient-to-t from-black/60 via-black/10 to-transparent",
    gapClass: "gap-4",
    roundingClass: "rounded-lg",
    titleClasses: {
      L: "text-2xl font-medium tracking-normal text-gray-100",
      M: "text-lg font-medium tracking-normal text-gray-100",
      S: "text-sm font-medium tracking-normal text-gray-200",
    },
    metaClass: "text-gray-400 text-[11px]",
  },
  bold: {
    containerClass: "auto-rows-[10px]",
    cardClass: "bg-[var(--bg-base)] border-2 border-[var(--text-primary)] shadow-[4px_4px_0_0_rgb(0,0,0)] hover:shadow-[6px_6px_0_0_rgb(0,0,0)] hover:scale-[1.02] transition-all duration-200",
    overlayClass: "bg-gradient-to-t from-black/80 via-black/30 to-transparent",
    gapClass: "gap-4",
    roundingClass: "rounded-none",
    titleClasses: {
      L: "text-2xl font-bold tracking-tight uppercase",
      M: "text-lg font-bold tracking-tight uppercase",
      S: "text-sm font-bold tracking-tight uppercase",
    },
    metaClass: "text-white text-[11px] font-semibold",
  },
  coastal: {
    containerClass: "auto-rows-[10px]",
    cardClass: "bg-[#F8F6F2] border-0 shadow-sm hover:shadow-lg transition-shadow duration-500",
    overlayClass: "bg-gradient-to-t from-black/45 via-transparent to-transparent",
    gapClass: "gap-5",
    roundingClass: "rounded-xl",
    titleClasses: {
      L: "text-2xl font-light tracking-wide",
      M: "text-lg font-light tracking-wide",
      S: "text-sm font-light tracking-wide",
    },
    metaClass: "text-white/80 text-[11px]",
  },
  eclectic: {
    containerClass: "auto-rows-[10px]",
    cardClass: "bg-[var(--bg-base)] border border-[var(--ridge-outer)] shadow-md hover:shadow-2xl hover:rotate-1 transition-all duration-300",
    overlayClass: "bg-gradient-to-t from-black/60 via-black/15 to-transparent",
    gapClass: "gap-3",
    roundingClass: "rounded-lg",
    titleClasses: {
      L: "text-2xl font-semibold tracking-normal",
      M: "text-lg font-semibold tracking-normal",
      S: "text-sm font-semibold tracking-normal",
    },
    metaClass: "text-white/85 text-[11px]",
  },
  default: {
    containerClass: "auto-rows-[8px]",
    cardClass: "bg-[var(--bg-base)] border border-[var(--ridge-outer)] shadow-sm hover:shadow-md transition-shadow duration-300",
    overlayClass: "bg-gradient-to-t from-black/60 via-black/10 to-transparent",
    gapClass: "gap-3",
    roundingClass: "rounded-xl",
    titleClasses: {
      L: "text-xl font-semibold leading-tight",
      M: "text-lg font-semibold leading-tight",
      S: "text-sm font-semibold leading-tight",
    },
    metaClass: "text-white/85 text-[11px]",
  },
};

function pickImage(project: UIProject) {
  return project.heroImageUrl || project.coverImageUrl || project.imageUrl || "/images/event-placeholder.jpg";
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

function scoreProject(project: UIProject, viewer?: ViewerFingerprint | null): number {
  let score = 0;
  score += (project.saveCount ?? 0) * 3;
  score += (project.viewCount ?? 0) * 0.5;
  score += project.isFeatured ? 100 : 0;
  
  // Viewer-specific relevance
  if (viewer?.aestheticVector && project.aestheticVector) {
    const similarity = cosineSimilarity(project.aestheticVector, viewer.aestheticVector);
    score += similarity * 150; // Heavy weight on style match
  }
  
  if (viewer?.interestedRooms?.includes(project.roomType ?? "")) {
    score += 40;
  }
  
  return score;
}

function assignSizes(
  projects: UIProject[],
  theme: AestheticTheme,
  viewer?: ViewerFingerprint | null
): { item: UIProject; size: Size }[] {
  const ranked = [...projects].sort((a, b) => scoreProject(b, viewer) - scoreProject(a, viewer));
  const n = ranked.length;

  // Theme-specific size distributions
  let largeRatio = 0.08;
  let mediumRatio = 0.40;
  
  if (theme === "minimal") {
    largeRatio = 0.05;
    mediumRatio = 0.35;
  } else if (theme === "bold" || theme === "editorial") {
    largeRatio = 0.12;
    mediumRatio = 0.35;
  } else if (theme === "eclectic") {
    largeRatio = 0.10;
    mediumRatio = 0.45;
  }

  const largeCount = Math.max(2, Math.floor(n * largeRatio));
  const mediumCount = Math.max(6, Math.floor(n * mediumRatio));
  
  const Ls = ranked.slice(0, largeCount).map(item => ({ item, size: "L" as const }));
  const Ms = ranked.slice(largeCount, largeCount + mediumCount).map(item => ({ item, size: "M" as const }));
  const Ss = ranked.slice(largeCount + mediumCount).map(item => ({ item, size: "S" as const }));

  const out: { item: UIProject; size: Size }[] = [];
  const take = (arr: typeof Ls | typeof Ms | typeof Ss) => arr.length ? out.push(arr.shift()!) : null;

  // Interleave pattern
  while (Ls.length || Ms.length || Ss.length) {
    take(Ls);
    take(Ms);
    take(Ss);
    take(Ms);
    take(Ss);
    take(Ms);
  }
  
  return out;
}

const rowUnit = 8;

function spanFor(size: Size, cols: number) {
  if (size === "L") {
    const col = cols >= 6 ? 4 : cols >= 4 ? 3 : 2;
    const row = cols >= 6 ? 34 : cols >= 4 ? 32 : 30;
    return { colSpan: Math.min(col, cols), rowSpan: row };
  }
  if (size === "M") {
    const col = 2;
    const row = cols >= 4 ? 26 : 24;
    return { colSpan: Math.min(col, cols), rowSpan: row };
  }
  return { colSpan: 1, rowSpan: 18 };
}

function useEstimatedCols() {
  if (typeof window === "undefined") return 4;
  const w = window.innerWidth;
  if (w >= 1280) return 6;
  if (w >= 1024) return 4;
  if (w >= 640) return 2;
  return 1;
}

export default function ProjectMosaic({ projects, theme, viewer, canEdit = false }: ProjectMosaicProps) {
  const cols = useEstimatedCols();
  const config = themeConfigs[theme] || themeConfigs.default;

  const sized = useMemo(
    () => assignSizes(projects, theme, viewer),
    [projects, theme, viewer]
  );

  return (
    <div
      className={clsx(
        "grid grid-flow-dense",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6",
        config.containerClass,
        config.gapClass
      )}
    >
      {sized.map(({ item, size }) => {
        const { colSpan, rowSpan } = spanFor(size, cols);
        const href = `/project/${item.id}`;
        const img = pickImage(item);

        return (
          <article
            key={item.id}
            className={clsx(
              "group relative overflow-hidden",
              config.cardClass,
              config.roundingClass,
              `col-span-${colSpan}`
            )}
            style={{ gridRowEnd: `span ${rowSpan}` }}
          >
            <Link href={href} className="absolute inset-0 z-30 block" aria-label={item.title ?? "View project"} />
            <div className="relative h-full">
              <div className="absolute inset-0 pointer-events-none">
                <SafeImage
                  src={img}
                  alt={item.title ?? "Project"}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  className="object-cover"
                />
                <div className={clsx("absolute inset-0 z-10 pointer-events-none", config.overlayClass)} />
              </div>

              <div className="relative z-20 pointer-events-none flex h-full items-end p-3">
                <div className="text-white w-full">
                  <div className={clsx("leading-tight", config.titleClasses[size])}>
                    {item.title}
                  </div>
                  {(item.saveCount ?? 0) > 0 && (
                    <div className={clsx("mt-1", config.metaClass)}>
                      {item.saveCount} {item.saveCount === 1 ? 'save' : 'saves'}
                    </div>
                  )}
                </div>
              </div>

              {canEdit && (
                <div className="absolute top-2 right-2 z-40 pointer-events-auto">
                  <Link
                    href={`/designer/projects/${item.id}`}
                    className="pointer-events-auto rounded bg-black/60 text-white text-[11px] px-2 py-1 hover:bg-black/80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ✎ Edit
                  </Link>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}


