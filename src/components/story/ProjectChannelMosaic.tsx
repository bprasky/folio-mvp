'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import SafeImage from '@/components/SafeImage';
import { curateChannelTiles, type ChannelTile, type ChannelKind } from '@/lib/project-channel/curation';

type Filter = 'all' | ChannelKind;
const tabs: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'space', label: 'Spaces' },
  { id: 'media', label: 'Media' }, { id: 'credit', label: 'Credits' },
];
export function ProjectChannelMosaic({ tiles, ownerView = false }: { tiles: ChannelTile[]; ownerView?: boolean }) {
  const [filter, setFilter] = useState<Filter | 'shop'>('all');
  const activeFilter = filter === 'shop' && !ownerView ? 'all' : filter;
  const available = tabs.filter(tab => tab.id === 'all' || tab.id === 'space' || tiles.some(tile => tile.kind === tab.id));
  const filtered = useMemo(() => curateChannelTiles(tiles.filter(tile => activeFilter === 'all' || tile.kind === activeFilter)), [tiles, activeFilter]);
  const sparseVisuals = filtered.length <= 3 && filtered.every(tile => !!tile.imageUrl);
  return <div className="mx-auto max-w-7xl px-5 py-12 sm:px-10">
    <nav aria-label="Browse project content" className="mb-7 flex flex-wrap items-center gap-2">
      {available.map(tab => <button key={tab.id} type="button" aria-pressed={activeFilter === tab.id} aria-controls="channel-tiles"
        onClick={() => setFilter(tab.id)} className={`min-h-11 rounded-full px-5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${activeFilter === tab.id ? 'bg-[#eee9df] text-[#171715]' : 'border border-white/30 text-white/80 hover:border-white'}`}>{tab.label}</button>)}
      {ownerView && <button type="button" onClick={() => setFilter('shop')} aria-pressed={activeFilter === 'shop'} aria-controls="channel-tiles" className={`min-h-11 rounded-full border px-5 text-sm ${activeFilter === 'shop' ? 'border-white text-white' : 'border-white/25 text-white/80'}`}>Shop <span className="ml-1 text-[length:var(--type-fine)] uppercase tracking-wide">Coming Soon</span></button>}
    </nav>
    <p className="sr-only" role="status">{activeFilter === 'shop' ? 'Private designer preview' : `${filtered.length} project items`}</p>
    {activeFilter === 'shop' && ownerView ? <div id="channel-tiles" className="max-w-xl rounded-xl border border-white/20 bg-white/5 p-8">
      <p className="text-xs uppercase tracking-[var(--ls-eyebrow)] text-white/75">Private designer preview</p>
      <h2 className="mt-3 font-serif text-3xl text-[#f4efe7]">Your future project storefront</h2>
      <p className="mt-4 text-sm leading-relaxed text-white/80">Your tagged materials and products will help power a curated shop and future vendor collaborations. This is a preview only: no storefront, checkout or paid partnership is active.</p>
    </div> : <div id="channel-tiles" className="grid grid-cols-2 auto-rows-[180px] gap-3 md:grid-cols-4 md:auto-rows-[130px]">
      {filtered.length === 0 && <p className="col-span-full py-8 text-white/80">No content in this collection yet.</p>}
      {filtered.map(tile => {
        const className = `group relative min-w-0 overflow-hidden rounded-md bg-[#34312c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${sparseVisuals && filtered.length === 1 ? 'col-span-2 row-span-2 md:col-span-4 md:row-span-3' : sparseVisuals && filtered.length === 2 ? 'col-span-2 row-span-2 md:row-span-3' : sparseVisuals && filtered.length === 3 ? (tile.size === 'large' ? 'col-span-2 row-span-2 md:row-span-3' : 'col-span-1 row-span-2 md:row-span-3') : tile.size === 'large' ? 'col-span-2 row-span-2 md:row-span-3' : tile.size === 'medium' ? 'col-span-1 row-span-2' : 'col-span-1 row-span-1'}`;
        const content = <>
          {tile.imageUrl && <SafeImage key={tile.imageUrl} src={tile.imageUrl} alt="" fill unoptimized={tile.unoptimized}
            sizes={sparseVisuals && filtered.length === 1 ? '(max-width: 1280px) 100vw, 1200px' : tile.size === 'large' || (sparseVisuals && filtered.length === 2) ? '(max-width: 768px) 100vw, 600px' : '(max-width: 768px) 50vw, 300px'} className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.035]" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-[length:var(--type-fine)] uppercase tracking-[var(--ls-eyebrow)] text-white/80">{tile.kind === 'feature' ? 'Folio Feature' : tile.kind === 'space' ? 'Space' : tile.kind === 'credit' ? 'Credit' : 'Media'}</p>
            <h3 className="mt-1 line-clamp-3 break-words font-serif text-lg leading-tight text-white sm:text-xl">{tile.title}</h3>
          </div>
        </>;
        return tile.href ? <Link href={tile.href} key={tile.id} id={`module-${tile.id}`} className={className} data-kind={tile.kind} data-size={tile.size} aria-label={tile.title}>{content}</Link>
          : <article key={tile.id} className={className} data-kind={tile.kind} data-size={tile.size} aria-label={tile.title}>{content}</article>;
      })}
    </div>}
  </div>;
}
