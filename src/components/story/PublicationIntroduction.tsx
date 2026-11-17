'use client';

import type { StoryData } from '@/lib/story/buildRoomTiles';
import { LeadHeadline, LeadDeck, LeadIntro } from './StoryLead';
import { BreatherQuote } from './BreatherQuote';
import styles from './ImmersiveRooms.module.css';
import { PublicationText } from './PublicationText';
import { creditProfileHref, externalCreditHref, namedProfileHref } from '@/lib/story/profileLinks';

/** The cover's expanded story, shared by published pages and the studio. */
export function PublicationIntroduction({ story }: { story: StoryData }) {
  return <>
    <LeadHeadline story={story} as="h2" />
    <LeadDeck story={story} className={styles.deck} />
    {story.projectPullQuote && story.projectPullQuoteIsAttributed && <blockquote className={styles.readingQuote}>
      &ldquo;<PublicationText text={story.projectPullQuote} profiles={story.profileLinks} />&rdquo;<cite className={styles.quoteCredit}>&mdash; <PublicationText text={story.designerName} profiles={story.profileLinks} /></cite>
    </blockquote>}
    <LeadIntro story={story} />
    {story.breathers.map(breather => <BreatherQuote key={breather.id} breather={breather} profiles={story.profileLinks} reducedMotion immersive />)}
    {!!story.credits.length && <section className={styles.credits} aria-label="Project credits">
      <h3>Credits</h3>
      <dl>{story.credits.map((credit, index) => {
        const profile = creditProfileHref(credit) || namedProfileHref(credit.name, story.profileLinks);
        const href = profile || externalCreditHref(credit.url);
        return <div key={index}><dt>{credit.role}</dt><dd>{href
          ? <a href={href} target={profile ? undefined : '_blank'} rel={profile ? undefined : 'noopener noreferrer'}>{credit.name}</a> : credit.name}</dd></div>;
      })}</dl>
    </section>}
  </>;
}
