import type { StudioData, StudioFeedCard } from './types';

export interface StudioRecommendation {
  id: string;
  title: string;
  reason: string;
  label: string;
  cards: StudioFeedCard[];
}

const DAY = 86_400_000;
function age(date: string | null | undefined, today: number): number | null {
  if (!date) return null;
  const time = Date.parse(date);
  return Number.isFinite(time) && time <= today + DAY - 1 ? Math.max(0, (today - time) / DAY) : null;
}

/** A stable weekly tie-break gives older, equally useful projects a turn.
 * It cannot promote a weak pitch over a supported one or imply a social post.
 */
function rotation(id: string, week: number) {
  let hash = 2166136261;
  for (const character of `${id}:${week}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

/** No LLM calls, trend guesses, or interpretation of an export as publication. */
export function recommendStudioStories(data: Pick<StudioData, 'projects' | 'feed' | 'evaluatedAt'>, visible: StudioFeedCard[]): StudioRecommendation[] {
  const today = Date.parse((data.evaluatedAt || '').slice(0, 10));
  const week = Number.isFinite(today) ? Math.floor(today / DAY / 7) : 0;
  const groups: (StudioRecommendation & { score: number })[] = [];
  for (const project of data.projects) {
    const cards = visible.filter(card => card.kind === 'suggestion' && card.projectIds.length === 1 && card.projectIds[0] === project.id);
    if (!cards.length) continue;
    const rooms = cards.filter(card => card.roomId);
    const publicationAge = age(project.publishedAt, today);
    const recent = publicationAge !== null && publicationAge <= 30;
    const archive = publicationAge !== null && publicationAge >= 180;
    const activity = data.feed.filter(card => ['carousel', 'campaign'].includes(card.kind) && card.projectIds.includes(project.id)
      && age(card.updatedAt, today) !== null && age(card.updatedAt, today)! <= 14);
    const subject = rooms.length === 1 ? 'one story behind the room' : `${rooms.length} stories behind the rooms`;
    const substance = rooms.length ? `Explore ${subject}${cards.some(card => !card.roomId) ? ', with a project overview alongside' : ''}.` : 'Start with a visual introduction drawn from the published project.';
    const reason = recent ? `New to Folio in the past month. ${substance}`
      : archive ? `Published on Folio more than six months ago. ${substance}` : substance;
    groups.push({ id: `project:${project.id}`, title: recent ? `Put ${project.title} in focus` : archive ? `A ${project.title} refresh` : `Stories from ${project.title}`,
      label: recent ? 'New to Folio' : archive ? 'From your archive' : 'Project focus',
      reason: reason + (activity.length ? ' You have recently worked on social content for this project.' : ''),
      cards: [...rooms, ...cards.filter(card => !card.roomId)],
      score: (rooms.length ? 40 : 0) + Math.min(rooms.length, 3) * 3 + (recent ? 25 : archive ? 8 : 0)
        - Math.min(activity.length, 3) * 12 + rotation(project.id, week),
    });
  }
  const ideas = visible.filter(card => card.kind === 'idea' && ['recommended', 'suggested'].includes(card.status));
  for (const card of ideas) groups.push({ id: card.id, title: card.title, label: card.projectIds.length > 1 ? 'Across your projects' : 'An interview direction',
    reason: card.caption || 'Add your perspective to develop this story.', cards: [card], score: 35 });
  return groups.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).map(group => ({ id: group.id, title: group.title, reason: group.reason, label: group.label, cards: group.cards }));
}
