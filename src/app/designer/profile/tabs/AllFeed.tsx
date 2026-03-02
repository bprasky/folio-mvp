'use client';

import MosaicGrid, { MosaicCell } from '../MosaicGrid';
import LargeProjectCard from '../cards/LargeProjectCard';
import MediumProjectCard from '../cards/MediumProjectCard';
import ProductCard from '../cards/ProductCard';
import QuoteCard from '../cards/QuoteCard';
import TeamCard from '../cards/TeamCard';
import CollabCard from '../cards/CollabCard';
import type {
  ProfileProject,
  ProfileProduct,
  ProfileTeamMember,
  ProfileCollaboration,
  ProfileQuote,
} from '../types';

type MosaicItemType = 'project' | 'product' | 'quote' | 'team' | 'collaboration';
type MosaicSize = 'large' | 'medium' | 'small';

interface MosaicEntry {
  key: string;
  type: MosaicItemType;
  size: MosaicSize;
  data: any;
}

interface AllFeedProps {
  projects: ProfileProject[];
  products: ProfileProduct[];
  teamMembers: ProfileTeamMember[];
  collaborations: ProfileCollaboration[];
  quotes: ProfileQuote[];
}

/**
 * Builds a mixed mosaic feed interleaving projects, products, quotes, team, and collaborations.
 * Visual rhythm: large → small+small → medium → small → medium+medium → small+small → ...
 */
function buildMosaicFeed({
  projects,
  products,
  teamMembers,
  collaborations,
  quotes,
}: AllFeedProps): MosaicEntry[] {
  const items: MosaicEntry[] = [];

  // Small items pool: quotes, team, collaborations
  const smallPool: MosaicEntry[] = [];
  quotes.forEach((q, i) =>
    smallPool.push({ key: `quote-${i}`, type: 'quote', size: 'small', data: q })
  );
  teamMembers.forEach(m =>
    smallPool.push({ key: `team-${m.id}`, type: 'team', size: 'small', data: m })
  );
  collaborations.forEach((c, i) =>
    smallPool.push({ key: `collab-${i}`, type: 'collaboration', size: 'small', data: c })
  );

  // Medium products: ones with highest projectCount
  const sortedProducts = [...products].sort((a, b) => b.projectCount - a.projectCount);
  const heroProducts = sortedProducts.filter(p => p.projectCount >= 3);
  const regularProducts = sortedProducts.filter(p => p.projectCount < 3);

  let smallIdx = 0;
  let heroProductIdx = 0;
  let regularProductIdx = 0;

  const nextSmall = (): MosaicEntry | null => {
    if (smallIdx < smallPool.length) return smallPool[smallIdx++];
    return null;
  };
  const nextHeroProduct = (): MosaicEntry | null => {
    if (heroProductIdx < heroProducts.length) {
      const p = heroProducts[heroProductIdx++];
      return { key: `product-${p.id}`, type: 'product', size: 'medium', data: p };
    }
    return null;
  };
  const nextRegularProduct = (): MosaicEntry | null => {
    if (regularProductIdx < regularProducts.length) {
      const p = regularProducts[regularProductIdx++];
      return { key: `product-${p.id}`, type: 'product', size: 'small', data: p };
    }
    return null;
  };

  // Featured project → large
  if (projects.length > 0) {
    items.push({
      key: `project-${projects[0].id}`,
      type: 'project',
      size: 'large',
      data: projects[0],
    });
  }

  // Interleave: after featured, fill with small items, then hero product, then project, etc.
  const remainingProjects = projects.slice(1);

  // Add small items + hero product after featured
  let s = nextSmall();
  if (s) items.push(s);
  let hp = nextHeroProduct();
  if (hp) items.push(hp);
  s = nextSmall();
  if (s) items.push(s);

  // Rest of projects with interleaved content
  for (let i = 0; i < remainingProjects.length; i++) {
    const proj = remainingProjects[i];
    items.push({
      key: `project-${proj.id}`,
      type: 'project',
      size: 'medium',
      data: proj,
    });

    // After each project, insert 1-2 small items
    const rp = nextRegularProduct();
    if (rp) items.push(rp);

    s = nextSmall();
    if (s) items.push(s);

    // Every other project, add another hero product
    if (i % 2 === 0) {
      hp = nextHeroProduct();
      if (hp) items.push(hp);
    }
  }

  // Drain remaining items
  while (smallIdx < smallPool.length) {
    const item = nextSmall();
    if (item) items.push(item);
  }
  while (heroProductIdx < heroProducts.length) {
    const item = nextHeroProduct();
    if (item) items.push(item);
  }
  while (regularProductIdx < regularProducts.length) {
    const item = nextRegularProduct();
    if (item) items.push(item);
  }

  return items;
}

export default function AllFeed(props: AllFeedProps) {
  const { projects, products, teamMembers, collaborations, quotes } = props;

  const hasAnyContent =
    projects.length > 0 ||
    products.length > 0 ||
    teamMembers.length > 0 ||
    collaborations.length > 0 ||
    quotes.length > 0;

  if (!hasAnyContent) {
    return (
      <div className="text-center py-16">
        <p className="folio-body" style={{ color: 'var(--text-tertiary)' }}>
          Publish your first project to start building your portfolio.
        </p>
      </div>
    );
  }

  const feed = buildMosaicFeed(props);

  return (
    <MosaicGrid>
      {feed.map(item => (
        <MosaicCell key={item.key} size={item.size}>
          {item.type === 'project' && item.size === 'large' && (
            <LargeProjectCard project={item.data} />
          )}
          {item.type === 'project' && item.size === 'medium' && (
            <MediumProjectCard project={item.data} />
          )}
          {item.type === 'product' && <ProductCard product={item.data} />}
          {item.type === 'quote' && (
            <QuoteCard quote={item.data.text} attribution={item.data.attribution} />
          )}
          {item.type === 'team' && <TeamCard member={item.data} />}
          {item.type === 'collaboration' && (
            <CollabCard vendor={item.data.vendor} note={item.data.note} />
          )}
        </MosaicCell>
      ))}
    </MosaicGrid>
  );
}
