import Link from "next/link";
import Image from "next/image";
import type { HomepageHero } from "@/lib/homepage/getHomepageData";

export function HomepageHeroXL({ hero }: { hero: HomepageHero }) {
  return (
    <div className="px-4 sm:px-10 max-w-[1440px] mx-auto">
      <Link href={`/p/${hero.postSlug}`} className="group block sm:relative sm:overflow-hidden sm:rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
        <div className="relative overflow-hidden rounded-lg sm:rounded-none aspect-[4/3] sm:aspect-[21/10] sm:min-h-[600px]">
          <Image src={hero.heroImageUrl} alt={hero.title} fill priority
            sizes="(min-width: 1440px) 1360px, (min-width: 640px) calc(100vw - 80px), calc(100vw - 32px)"
            className="object-cover" />
          <div className="absolute inset-0 hidden sm:block pointer-events-none"
            style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.41) 30%, rgba(0,0,0,0.082) 52%, transparent 68%), linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 22%)" }} />
        </div>
        <div className="mt-4 sm:mt-0 sm:absolute sm:top-9 sm:left-9">
          <span className="folio-eyebrow text-folio-text-primary sm:inline-block sm:px-4 sm:py-1.5 sm:rounded-full sm:bg-white/90 sm:backdrop-blur-md">{hero.eyebrow}</span>
        </div>
        <div className="mt-2 sm:mt-0 sm:absolute sm:left-9 sm:right-9 sm:bottom-9">
          <h1 className="max-w-[800px] text-folio-text-primary sm:text-white break-words [font-family:var(--font-headline)] [letter-spacing:var(--ls-tight)] text-[30px] leading-[1.1] sm:[font-size:var(--type-h1)] sm:[line-height:var(--lh-h1)] [font-weight:var(--w-h1)]">{hero.title}</h1>
          <div className="mt-3 sm:mt-2 flex items-center justify-between gap-4">
            {(hero.designerName || hero.studio) && <p className="folio-meta text-folio-text-secondary sm:text-white/85 min-w-0 break-words">{hero.studio ?? hero.designerName}</p>}
            <span className="sm:hidden shrink-0 text-sm text-folio-text-primary">Read story <span aria-hidden>↗</span></span>
          </div>
        </div>
      </Link>
    </div>
  );
}
