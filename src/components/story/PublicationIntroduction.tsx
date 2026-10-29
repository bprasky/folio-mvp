'use client';

import type { StoryData } from '@/lib/story/buildRoomTiles';
import { LeadHeadline, LeadDeck, LeadIntro } from './StoryLead';
import { BreatherQuote } from './BreatherQuote';
import styles from './ImmersiveRooms.module.css';

/** The cover's expanded story, shared by published pages and the studio. */
export function PublicationIntroduction({ story }: { story: StoryData }) {
  return <>
    <LeadHeadline story={story} as="h2" />
    <LeadDeck story={story} className={styles.deck} />
    {story.projectPullQuote && story.projectPullQuoteIsAttributed && <blockquote className={styles.readingQuote}>
      “{story.projectPullQuote}”<cite className={styles.quoteCredit}>— {story.designerName}</cite>
    </blockquote>}
    <LeadIntro story={story} />
    {story.breathers.map(breather => <BreatherQuote key={breather.id} breather={breather} reducedMotion immersive />)}
    {!!story.credits.length && <section className={styles.credits} aria-label="Project credits">
      <h3>Credits</h3>
      <dl>{story.credits.map((credit, index) => <div key={index}>
        <dt>{credit.role}</dt><dd>{credit.url
          ? <a href={credit.url} target="_blank" rel="noopener noreferrer">{credit.name}</a> : credit.name}</dd>
      </div>)}</dl>
    </section>}
  </>;
}
