import { z } from 'zod';
const citation = z.object({ evidenceId: z.string(), quote: z.string().min(1) });
export const DiscoverySchema = z.object({ opportunities: z.array(z.object({
  thesis: z.string().min(1).max(240), readerBenefit: z.string().min(1).max(400), comparisonType: z.string().min(1).max(80),
  evidence: z.array(citation).min(2).max(12), gaps: z.array(z.string().max(300)).max(8),
  qualification: z.array(z.string().max(400)).min(1).max(5),
  ranking: z.object({ evidence: z.number().min(0).max(5), specificity: z.number().min(0).max(5), clientValue: z.number().min(0).max(5), novelty: z.number().min(0).max(5), effort: z.number().min(0).max(5) }),
  duplicateOf: z.array(z.string()).max(20),
})).max(8) });
export const FollowUpSchema = z.object({
  question: z.object({ purpose: z.enum(['orient','context','comparison','judgment','confirm']), text: z.string().min(1).max(600), evidenceIds: z.array(z.string()).max(12), gapId: z.string().min(1).max(100) }).nullable(),
  coverage: z.array(z.object({ kind: z.enum(['angle','example','reasoning','judgment']), projectId: z.string().optional(), evidenceId: z.string().optional(), answerId: z.string().optional(), quote: z.string().min(1) })).max(30),
  contradictions: z.array(z.string().max(300)).max(8), gaps: z.array(z.string().max(300)).max(8),
});
export const ArticleCompositionSchema = z.object({
  title: z.string().min(1).max(240), introduction: z.object({ text: z.string().max(6000), sourceId: z.string() }),
  passages: z.array(z.object({ sourceId: z.string(), text: z.string().min(1).max(12000), mediaEvidenceIds: z.array(z.string()).max(12).default([]) })).min(1).max(30),
  mediaEvidenceIds: z.array(z.string()).min(2).max(12),
});
export const ExpertiseArticleSchema = z.object({
  title: z.string().trim().min(1).max(240), introduction: z.string().max(6000),
  introductionEvidenceIds: z.array(z.string()).max(30).default([]), introductionAnswerIds: z.array(z.string()).max(30).default([]),
  titleEvidenceIds: z.array(z.string()).max(30).default([]), titleAnswerIds: z.array(z.string()).max(30).default([]),
  claims: z.array(z.object({ id:z.string(),text:z.string().trim().min(1).max(12000),evidenceIds:z.array(z.string()).max(30),answerIds:z.array(z.string()).max(30),status:z.enum(['observed','designer_confirmed','attributed','unresolved','contradicted']) })).min(1).max(50),
  media:z.array(z.object({evidenceId:z.string(),assetId:z.string(),projectId:z.string(),projectName:z.string(),roomName:z.string().optional(),url:z.string(),caption:z.string().max(2000),alt:z.string().min(1).max(1000),photographer:z.string().optional()})).min(2).max(30),
  cover:z.enum(['project','portrait','logo']),coverUrl:z.string().optional(),coverPosition:z.object({x:z.number().min(0).max(100),y:z.number().min(0).max(100)}).optional(),featured:z.boolean(),thesisRevision:z.number().int().positive(),reviewed:z.boolean(),
});
