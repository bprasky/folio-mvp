/**
 * Cinematic Intro Configuration
 * 
 * Defines the intro sections for Individual, Designer, and Vendor roles
 * in the investor demo flow.
 */

export type CinematicIntroSection = {
  title: string;
  body?: string;
  body2?: string;
  bullets?: string[];
  ctaLabel?: string;
};

export const INDIVIDUAL_INTRO_SECTIONS: CinematicIntroSection[] = [
  {
    title: 'Design is fragmented for individuals.',
    body: 'Screenshots, Pinterest boards, and random links everywhere. You can\'t tell what\'s real: what can you actually buy?',
    body2: 'It\'s hard to find a designer who truly matches your taste and budget.',
    ctaLabel: 'Next',
  },
  {
    title: 'Folio turns inspiration into progress.',
    body: 'Every image is real and fully tagged with products.',
    body2: 'You can save everything into one place.\n\nWhen you\'re ready, Folio helps you hire the right designer.',
    ctaLabel: 'Let\'s start',
  },
];

export const DESIGNER_INTRO_SECTIONS: CinematicIntroSection[] = [
  {
    title: 'The design industry is backwards.',
    body: 'Designers and architects are some of the most talented creatives in the world — yet too many still fight for exposure, pay for recognition, and battle ad-driven publications for a chance to be seen.',
    body2: 'The moment a contract is signed, your value begins to decay. Hours run over. Extra meetings dilute profit. Reselections stall progress and hold the next payout hostage. When the project is finally finished, your work is posted to feeds designed to disappear — built on algorithms meant to bury what deserves to live.',
    ctaLabel: 'Next',
  },
  {
    title: 'Creators deserve better.',
    body: 'A place where your work lives as long as you want it to.',
    body2: 'A place where your talent earns for you.\n\nA place that builds value instead of draining it.\n\nA place where your portfolio works for you, every hour of every day.\n\nThis is Folio.',
    ctaLabel: 'Begin',
  },
];

export const VENDOR_INTRO_SECTIONS: CinematicIntroSection[] = [
  {
    title: 'Vendors spend huge budgets on events that vanish in 72 hours.',
    body: 'Booths are expensive but disappear the moment the show ends.',
    body2: 'Tracking who visited and what they cared about is messy at best.\n\nInvites and RSVPs live in spreadsheets and third-party tools.',
    ctaLabel: 'Next',
  },
  {
    title: 'Folio turns event spend into a permanent, measurable asset.',
    body: 'Events, designers, and products all live in one ecosystem.',
    body2: 'You can see which designers saved which products, and when.\n\nSoon, your booth becomes a permanent Unreal-powered digital showroom.',
    ctaLabel: 'Let\'s start',
  },
];




