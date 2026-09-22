import type { ExpertiseOpportunity, ExpertiseSession, ExpertiseQuestion, ExpertiseArticle } from './types';
import { ExpertiseArticleSchema, type FollowUpSchema } from './generation.schemas';
import type { z } from 'zod';

export function verifiedImageObservation(attributes: Record<string, unknown>): string | null {
  const elements = Array.isArray(attributes.elements) ? attributes.elements : [];
  const configurations = elements.filter((value): value is string => typeof value === 'string' && /\b(?:open|closed|recessed|built[ -]in|full[ -]height|floor[ -]to[ -]ceiling|wall[ -]mounted|freestanding|vaulted|double[ -]height)\b.*\b(?:shel(?:f|ves|ving)|cabinet(?:s|ry)?|storage|niches?|ceiling|windows?|island)\b/i.test(value));
  return configurations.length ? `Designer-verified spatial features: ${configurations.join('; ')}. The reason for this configuration is not yet confirmed.` : null;
}

export function createSession(opportunity: ExpertiseOpportunity): ExpertiseSession {
  const question: ExpertiseQuestion = { id: 'question:1:1', purpose: 'orient', text: `${opportunity.thesis} Is this a useful comparison to make, and what shaped these decisions?`, evidenceIds: opportunity.evidence.map(e => e.id), gapId: 'angle', thesisRevision: 1, followUp: 0 };
  return { opportunityId: opportunity.id, thesis: opportunity.thesis, thesisRevision: 1, questions: [question], answers: [], corrections: [], coverage: { angle: false, examples: [], reasoning: false, judgment: false, confirmed: false, contradictions: [], gaps: opportunity.gaps }, position: 0, nextQuestion: question, status: 'interview' };
}

export function answerSession(session: ExpertiseSession, text: string, options: { skip?: boolean; correction?: boolean; evidenceIds?: string[] } = {}): ExpertiseSession {
  const question = session.nextQuestion;
  if (!question) throw new Error('Choose an interview question before saving an answer.');
  if (!options.skip && !text.trim()) throw new Error('Add your answer or choose Skip.');
  if (text.length > 12000) throw new Error('Keep this answer within 12,000 characters.');
  const knownIds = new Set(session.questions.flatMap(q => q.evidenceIds));
  if (options.evidenceIds?.some(id => !knownIds.has(id))) throw new Error('Choose evidence from this interview.');
  const next: ExpertiseSession = JSON.parse(JSON.stringify(session));
  if (options.correction) {
    const affected = options.evidenceIds?.length ? options.evidenceIds : question.evidenceIds;
    next.thesisRevision += 1;
    // The original interpretation is abandoned; only the designer's replacement can frame the article.
    next.thesis = text.trim();
    next.corrections.push({ text: text.trim(), evidenceIds: affected, revision: next.thesisRevision });
    next.answers = next.answers.map(a => affected.some(id => a.evidenceIds.includes(id)) ? { ...a, invalidated: true } : a);
    next.coverage = { angle: false, examples: [], reasoning: false, judgment: false, confirmed: false, contradictions: [], gaps: ['Confirm the corrected comparison and its supporting examples.'] };
  }
  const answer = { id: `answer:${next.answers.length + 1}`, questionId: question.id, purpose: question.purpose, text: text.trim(), evidenceIds: options.evidenceIds || question.evidenceIds, thesisRevision: next.thesisRevision, skipped: !!options.skip };
  next.answers.push(answer);
  next.position = next.answers.length;
  next.nextQuestion = null;
  next.coverage.confirmed = question.purpose === 'confirm' && !options.skip && !options.correction;
  if (options.skip) next.coverage.gaps = Array.from(new Set([...next.coverage.gaps, `Still needed: ${question.gapId}`]));
  next.status = 'interview';
  return next;
}

export function applyFollowUp(session: ExpertiseSession, result: z.infer<typeof FollowUpSchema>, opportunity: ExpertiseOpportunity): ExpertiseSession {
  const coverage = { angle: false, examples: [] as string[], reasoning: false, judgment: false, confirmed: session.coverage.confirmed, contradictions: result.contradictions, gaps: result.gaps };
  for (const item of result.coverage) {
    const answer = session.answers.find(a => a.id === item.answerId && !a.skipped && !a.invalidated);
    const evidence = opportunity.evidence.find(e => e.id === item.evidenceId);
    if (!item.quote.trim() || (!answer && session.corrections.some(c => c.evidenceIds.includes(item.evidenceId || '')))) throw new Error('Corrected evidence cannot establish the old premise.');
    if (item.answerId ? !answer?.text.includes(item.quote) : !evidence?.text.includes(item.quote)) throw new Error('Interview coverage could not be matched to its source.');
    if (item.kind === 'example') {
      if (!item.projectId || !opportunity.projectIds.includes(item.projectId) || (evidence && evidence.projectId !== item.projectId) || (answer && !answer.evidenceIds.some(id => opportunity.evidence.some(e => e.id === id && e.projectId === item.projectId)))) throw new Error('An example needs its exact project source.');
      coverage.examples.push(item.projectId);
    } else {
      // Intent and comparative judgment must come from the designer, never from photographs or published interpretation.
      if (!answer && evidence?.kind !== 'designer_answer') throw new Error('Confirm the reasoning in your own words.');
      coverage[item.kind] = true;
    }
  }
  coverage.examples = Array.from(new Set(coverage.examples));
  const next = { ...session, coverage };
  if (readyToDraft(next, opportunity)) return { ...next, nextQuestion: null, status: 'ready' as const };
  const complete = coverage.angle && coverage.examples.length >= 2 && coverage.reasoning && coverage.judgment && !coverage.contradictions.length && !coverage.gaps.length;
  const proposed = complete ? { purpose: 'confirm' as const, text: `The article will explore: ${session.thesis}. Do these examples and this framing represent your view? You can correct the premise before composing.`, evidenceIds: opportunity.evidence.map(e => e.id), gapId: 'confirm' } : result.question;
  if (proposed?.purpose === 'confirm' && !complete) throw new Error('Resolve the remaining coverage before confirming the framing.');
  if (!proposed) throw new Error('The interview still needs a focused next question. Your saved answers are unchanged.');
  if (proposed.evidenceIds.some(id => !opportunity.evidence.some(e => e.id === id))) throw new Error('The next question refers to unavailable evidence.');
  const followUp = session.questions.filter(q => q.gapId === proposed.gapId && q.thesisRevision === session.thesisRevision).length;
  const question = { ...proposed, id: `question:${session.thesisRevision}:${session.questions.length + 1}`, thesisRevision: session.thesisRevision, followUp,
    ...(followUp >= 2 ? { choices: ['Move on', 'Replace the example', 'Save for later'] } : {}) };
  return { ...next, questions: [...session.questions, question], nextQuestion: question, status: complete ? 'confirm' as const : 'interview' as const };
}

export function readyToDraft(session: ExpertiseSession, opportunity: ExpertiseOpportunity) {
  const c = session.coverage;
  return c.angle && c.reasoning && c.judgment && c.confirmed && !c.contradictions.length && !c.gaps.length && new Set(c.examples.filter(id => opportunity.projectIds.includes(id))).size >= 2;
}

export function validateArticle(input: ExpertiseArticle, opportunity: ExpertiseOpportunity, session: ExpertiseSession): ExpertiseArticle {
  const parsed = ExpertiseArticleSchema.safeParse(input);
  if (!parsed.success) throw new Error('Keep a title, supported passages and complete project photographs.');
  const article = parsed.data;
  if (new Set(article.claims.map(c => c.id)).size !== article.claims.length || new Set(article.media.map(m => m.assetId)).size !== article.media.length) throw new Error('Use each passage and supporting photograph once.');
  const leadingEvidence = [...article.titleEvidenceIds,...article.introductionEvidenceIds];
  const leadingAnswers = [...article.titleAnswerIds,...article.introductionAnswerIds];
  if (leadingEvidence.some(id => !opportunity.evidence.some(e => e.id === id)) || leadingAnswers.some(id => !session.answers.some(a => a.id === id && !a.invalidated && !a.skipped))) throw new Error('The title or introduction needs current supporting sources.');
  if (!readyToDraft(session, opportunity) || article.thesisRevision !== session.thesisRevision) throw new Error('Confirm the current angle and resolve the remaining interview gaps.');
  if (!article.title.trim() || article.title.length > 240 || article.introduction.length > 6000 || !article.claims.length || article.claims.length > 50) throw new Error('Add a title and supported article text.');
  for (const claim of article.claims) {
    if (!claim.text.trim() || claim.text.length > 12000 || ['unresolved','contradicted'].includes(claim.status) || (!claim.evidenceIds.length && !claim.answerIds.length)) throw new Error('Every passage needs confirmed evidence.');
    if (!claim.answerIds.length && claim.evidenceIds.some(id => session.corrections.some(c => c.evidenceIds.includes(id)))) throw new Error('Replace the corrected passage before continuing.');
    if (claim.evidenceIds.some(id => !opportunity.evidence.some(e => e.id === id)) || claim.answerIds.some(id => !session.answers.some(a => a.id === id && !a.invalidated && !a.skipped))) throw new Error('A passage uses an unavailable or corrected source.');
  }
  for (const media of article.media) {
    const source = opportunity.evidence.find(e => e.id === media.evidenceId);
    if (!source || !source.assetId || source.assetId !== media.assetId || source.projectId !== media.projectId || source.imageUrl !== media.url) throw new Error('Choose the exact supporting project photograph.');
  }
  if (new Set(article.media.map(m => m.projectId)).size < 2) throw new Error('Choose supporting photographs from at least two projects.');
  return article;
}
