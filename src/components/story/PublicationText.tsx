import type { ReactNode } from 'react';
import type { ProfileReference } from '@/lib/story/profileLinks';
import styles from './PublicationText.module.css';

/** Link exact, unambiguous credited names without rewriting published wording. */
export function PublicationText({ text, profiles = [] }: { text: string; profiles?: ProfileReference[] }) {
  if (!profiles.length) return <>{text}</>;
  const names = [...profiles].sort((a, b) => b.name.length - a.name.length);
  const pattern = new RegExp(names.map(ref => ref.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'giu');
  const parts: ReactNode[] = [];
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index!, after = start + match[0].length;
    if ((start && /[\p{L}\p{N}_]/u.test(text[start - 1])) || /[\p{L}\p{N}_]/u.test(text[after] || '')) continue;
    const ref = names.find(item => item.name.toLocaleLowerCase() === match[0].toLocaleLowerCase());
    if (!ref) continue;
    parts.push(text.slice(end, start), <a key={start} href={ref.href} className={styles.link}>{match[0]}</a>);
    end = after;
  }
  parts.push(text.slice(end));
  return <>{parts}</>;
}
