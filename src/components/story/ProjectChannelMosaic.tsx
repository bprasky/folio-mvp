'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Expand, Play } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { curateChannelTiles, type ChannelTile, type ChannelKind } from '@/lib/project-channel/curation';
import { ProjectPhotoViewer } from './ProjectPhotoViewer';
import styles from './ProjectChannel.module.css';

type Filter = 'all' | ChannelKind;
const tabs: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'space', label: 'Spaces' },
  { id: 'media', label: 'Media' }, { id: 'credit', label: 'Credits' },
];
export function ProjectChannelMosaic({ tiles, ownerView = false, projectTitle }: { tiles: ChannelTile[]; ownerView?: boolean; projectTitle: string }) {
  const [filter, setFilter] = useState<Filter | 'shop'>('all');
  const [photoId, setPhotoId] = useState<string | null>(null);
  const returnTo = useRef<HTMLButtonElement | null>(null);
  const available = tabs.filter(tab => tab.id === 'all' || tab.id === 'space' || tiles.some(tile => tile.kind === tab.id));
  const activeFilter = filter === 'shop' ? (ownerView ? filter : 'all') : available.some(tab => tab.id === filter) ? filter : 'all';
  const curated = useMemo(() => curateChannelTiles(tiles), [tiles]);
  const filtered = useMemo(() => curateChannelTiles(tiles.filter(tile => activeFilter === 'all' || tile.kind === activeFilter)), [tiles, activeFilter]);
  const photos = useMemo(() => curated.filter(tile => tile.kind === 'space' && tile.imageUrl && !tile.href), [curated]);
  const sparseVisuals = filtered.length <= 3 && filtered.every(tile => !!tile.imageUrl);
  return <div className={styles.mosaic}>
    <nav aria-label="Browse project content" className={styles.filters}>
      {available.map(tab => <button key={tab.id} type="button" aria-pressed={activeFilter === tab.id} aria-controls="channel-tiles"
        onClick={() => setFilter(tab.id)} className={styles.filter}>{tab.label}</button>)}
      {ownerView && <button type="button" onClick={() => setFilter('shop')} aria-pressed={activeFilter === 'shop'} aria-controls="channel-tiles" className={styles.filter}>Shop <span className={styles.comingSoon}>Coming Soon</span></button>}
    </nav>
    <p className="sr-only" role="status">{activeFilter === 'shop' ? 'Private designer preview' : `${filtered.length} project items`}</p>
    {activeFilter === 'shop' && ownerView ? <div id="channel-tiles" className={styles.shop}>
      <p className={styles.eyebrow}>Private designer preview</p>
      <h2>Your future project storefront</h2>
      <p>Your tagged materials and products will help power a curated shop and future vendor collaborations. This is a preview only: no storefront, checkout or paid partnership is active.</p>
    </div> : <div id="channel-tiles" className={styles.grid} data-sparse={sparseVisuals ? filtered.length : undefined}>
      {filtered.length === 0 && <p className="col-span-full py-8">No content in this collection yet.</p>}
      {filtered.map(tile => {
        const isPhoto = tile.kind === 'space' && !!tile.imageUrl && !tile.href;
        const Mark = tile.kind === 'media' ? Play : isPhoto ? Expand : ArrowUpRight;
        const content = <>
          {tile.imageUrl && <SafeImage key={tile.imageUrl} src={tile.imageUrl} alt="" fill unoptimized={tile.unoptimized}
            sizes={sparseVisuals && filtered.length === 1 ? '100vw' : tile.size === 'large' || (sparseVisuals && filtered.length === 2) ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 50vw, 25vw'} className={styles.tileImage} />}
          {tile.imageUrl && <div className={styles.tileShade} />}
          {tile.imageUrl && (tile.href || isPhoto) && <span className={styles.tileMark}><Mark size={16} aria-hidden="true" /></span>}
          <div className={styles.tileLabel}>
            <p className={styles.tileKind}>{tile.kind === 'feature' ? 'Folio Feature' : tile.kind === 'space' ? 'Space' : tile.kind === 'credit' ? 'Credit' : 'Media'}</p>
            <h3 className={styles.tileTitle}>{tile.title}</h3>
          </div>
        </>;
        const props = { className: styles.tile, 'data-kind': tile.kind, 'data-size': tile.size, 'data-visual': Boolean(tile.imageUrl), 'aria-label': tile.title };
        return tile.href ? <Link href={tile.href} key={tile.id} id={`module-${tile.id}`} {...props}>{content}</Link>
          : isPhoto ? <button type="button" key={tile.id} {...props} aria-haspopup="dialog" onClick={event => { returnTo.current = event.currentTarget; setPhotoId(tile.id); }}>{content}</button>
            : <article key={tile.id} {...props}>{content}</article>;
      })}
    </div>}
    <ProjectPhotoViewer photos={photos} photoId={photoId} projectTitle={projectTitle} onChange={setPhotoId} returnTo={returnTo} />
  </div>;
}
