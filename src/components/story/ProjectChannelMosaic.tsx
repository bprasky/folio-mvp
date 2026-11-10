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
  const available = tabs.filter(tab => tab.id === 'all' || tiles.some(tile => tile.kind === tab.id));
  const filtered = useMemo(() => curateChannelTiles(tiles.filter(tile => filter === 'all' || tile.kind === filter)), [tiles, filter]);
  return <div className="mx-auto max-w-7xl px-5 py-12 sm:px-10">
    <nav aria-label="Browse project content" className="mb-7 flex flex-wrap items-center gap-2">
      {available.map(tab => <button key={tab.id} type="button" aria-pressed={filter === tab.id}
        onClick={() => setFilter(tab.id)} className={`min-h-11 rounded-full px-5 text-sm transition-colors ${filter === tab.id ? 'bg-[#eee9df] text-[#171715]' : 'border border-white/30 text-white/80 hover:border-white'}`}>{tab.label}</button>)}
      {ownerView && <button type="button" onClick={() => setFilter('shop')} aria-pressed={filter === 'shop'} className={`min-h-11 rounded-full border px-5 text-sm ${filter === 'shop' ? 'border-white text-white' : 'border-white/25 text-white/50'}`}>Shop <span className="ml-1 text-[10px] uppercase tracking-wide">Coming soon</span></button>}
    </nav>
    {filter === 'shop' ? <div className="max-w-xl rounded-xl border border-white/20 bg-white/5 p-8">
      <p className="text-xs uppercase tracking-[.2em] text-white/60">Private designer preview</p>
      <h2 className="mt-3 font-serif text-3xl">Your future project storefront</h2>
      <p className="mt-4 text-sm leading-relaxed text-white/70">Your tagged materials and products will help power a curated shop and future vendor collaborations. This is a preview only: no storefront, checkout or paid partnership is active.</p>
    </div> : <div className="grid grid-flow-dense grid-cols-2 gap-3 md:grid-cols-4 md:auto-rows-[110px]">
      {filtered.map(tile => <Link href={tile.href} key={tile.id}
        className={`group relative min-h-44 overflow-hidden rounded-md bg-[#34312c] ${tile.size === 'large' ? 'col-span-2 row-span-3' : tile.size === 'medium' ? 'col-span-1 row-span-2' : 'col-span-1 row-span-1'}`}>
        {tile.imageUrl && <SafeImage src={tile.imageUrl} alt={tile.title} fill sizes="(max-width: 768px) 90vw, 45vw" className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.035]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-[10px] uppercase tracking-[.16em] text-white/70">{tile.kind === 'feature' ? 'Folio Feature' : tile.kind === 'space' ? 'Space' : tile.kind === 'credit' ? 'Credit' : 'Media'}</p>
          <h3 className="mt-1 font-serif text-lg leading-tight text-white sm:text-2xl">{tile.title}</h3>
        </div>
      </Link>)}
    </div>}
  </div>;
}
