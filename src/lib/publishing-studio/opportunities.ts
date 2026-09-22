import type { StudioFeedCard } from './types';
import type { Candidate } from './readiness/types';

/** Presentation over source-backed records. Never changes eligibility or publication state. */
export interface StudioOpportunity {
  purpose: string;
  reason: string;
  path: string;
  result: string;
  destination: string;
  action: string;
  metadata: string;
  href?: string;
}

export const personalIntroductionOpportunity: StudioOpportunity = {
  purpose: 'Let people meet the person behind your projects.',
  reason: 'Give potential clients and followers a feel for your personality, taste, and way of working.',
  path: 'Answer a playful 20-question interview. Save your progress and return when you like.',
  result: 'An article you can review and edit, plus selected answers as Instagram images.',
  destination: 'Publish to your profile’s About section and share the article link.',
  action: 'Create my introduction',
  metadata: '20 Questions · Shareable profile feature',
  href: '/designer/studio/activity?subject=designer&format=twenty_questions',
};

export function activityOpportunity(format: string, project?: {id:string;title:string}): StudioOpportunity {
  if (format === 'twenty_questions' && !project) return personalIntroductionOpportunity;
  if (format === 'bio') return {
    purpose:'Help the right clients understand your practice.', reason:'Make your profile introduction reflect the work and perspective you want people to know.',
    path:'Review what Folio knows, answer the interview, then edit your bio.',result:'A reviewed profile bio.',destination:'Update your Folio profile when you publish.',action:'Shape my bio',metadata:'Bio interview · Profile introduction',href:'/designer/studio/about-me?activity=bio',
  };
  const base = {result:'An editable Q&A article and selected answers as Instagram images.',destination:'Publish on your profile and share the article link.',metadata:`${format==='twenty_questions'?'20':'5'} questions · Save and return anytime`,href:`/designer/studio/activity?${new URLSearchParams({subject:project?'project':'designer',format,...(project?{projectId:project.id,...(format==='qa'?{chooseRoom:'1'}:{})}:{})})}`};
  if(format==='material') return {...base,purpose:'Share the judgment behind a material choice.',reason:'Give readers a closer look at a choice you can explain from experience.',path:'Choose a real example and answer five questions about your decision.',action:'Explore this choice'};
  if(format==='method') return {...base,purpose:'Show clients what working with you feels like.',reason:'Help a reader understand your process through an experience you choose.',path:'Answer five questions, then review the story in your own words.',action:'Share my process'};
  if(format==='twenty_questions')return {...base,purpose:`Bring people closer to ${project?.title}.`,reason:'Help readers understand the people and choices behind this project.',path:'Answer twenty questions grounded in the project, then review your article.',action:'Tell this project’s story'};
  return {...base,purpose:project?`Share a space that matters to you at ${project.title}.`:'Show people what you notice—and why.',reason:project?'Choose a room and explain a decision you want people to understand.':'Let readers understand your eye through specific choices and influences.',path:project?'Choose a room, answer five questions and review the article.':'Answer five questions about your perspective, then edit the article.',action:project?'Choose a room':'Share my perspective'};
}

export function feedOpportunity(item:StudioFeedCard, projectName:string):StudioOpportunity {
  const room=Boolean(item.roomId)||item.format.toLowerCase().replaceAll('_',' ')==='room story';
  const project=item.format.toLowerCase().replaceAll('_',' ')==='project story';
  const material=['material','material_study'].includes(item.format.toLowerCase());
  const cross=item.projectIds.length>1;
  return {
    purpose:project?`Give ${projectName||item.title} a fuller introduction.`:room?'Share the judgment behind this room.':material?'Share the judgment behind this choice.':cross?'Explore how your approach carries across projects.':'Give readers another way into your work.',
    reason:item.rationale||item.caption||'Review the source material and decide what you want readers to understand.',
    path:item.kind==='idea'?'Review the proposed direction and the questions it still needs.':!item.canPolish?'View the prepared source; editing is unavailable in this workspace.':'Review the prepared caption and images, then make them your own.',
    result:item.kind==='idea'?'A direction to keep for further development.':!item.canPolish?'A view of the prepared direction.':'A reviewed post with a caption and downloadable images.',
    destination:item.kind==='idea'?'Saved directions in Publishing Studio.':!item.canPolish?'Available to view in Publishing Studio.':'Download for sharing on Instagram; publication remains your choice.',
    action:item.kind==='idea'?'Explore this direction':!item.canPolish?'View this direction':project?'Review the introduction':room||material?'Share this decision':'Review this post',
    metadata:item.format,
  };
}

export function candidateOpportunity(candidate:Candidate):StudioOpportunity {
  const purposes:Partial<Record<Candidate['shape'],string>>={material:'Share the judgment behind this choice.',process:'Show clients how a project comes together.',pattern:'Explore connections across your projects.',point_of_view:'Show people what you notice—and why.'};
  const blockers=candidate.blockers.filter(b=>!b.answer?.trim());
  return {purpose:purposes[candidate.shape]||'Help readers understand this design decision.',reason:candidate.audienceValue||candidate.rationale,path:blockers.length?`Review the source and complete ${blockers.length} remaining ${blockers.length===1?'step':'steps'}.`:'Review the prepared caption and selected images.',result:candidate.readiness==='ready'?'A reviewed post and downloadable images.':'A draft to develop; export waits until the evidence and imagery are ready.',destination:'Download for sharing on Instagram. Record publication only after you share.',action:blockers.length?'Develop this story':'Review this story',metadata:(candidate.shape||'story').replaceAll('_',' ')};
}
