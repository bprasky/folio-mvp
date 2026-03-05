/**
 * Formalized editorial state machine for projects.
 *
 * Source of truth: tasks/17_EDITORIAL_FLOW_SPEC.md — Section 2
 *
 * States:
 *   EMPTY        — No interview answers AND no ProjectPost
 *   INTERVIEWED  — ≥1 interview answer AND no post with expandedBlocks
 *   GENERATED    — ProjectPost with expandedBlocks, never published
 *   PUBLISHED    — ProjectPost.status === 'PUBLISHED'
 *   UNPUBLISHED  — ProjectPost with expandedBlocks, status DRAFT, was previously published
 */

export type EditorialState = 'EMPTY' | 'INTERVIEWED' | 'GENERATED' | 'PUBLISHED' | 'UNPUBLISHED';

export function getEditorialState(project: {
  post?: {
    status: string;
    publishedAt: Date | null;
    expandedBlocks: any;
  } | null;
  interviewAnswerCount: number;
}): EditorialState {
  const { post, interviewAnswerCount } = project;

  // PUBLISHED: post.status is the ONLY check — never use Project.publishedAt
  if (post?.status === 'PUBLISHED') return 'PUBLISHED';

  // Post exists with generated content but not published
  if (post && post.expandedBlocks != null) {
    // Was previously published → UNPUBLISHED (publishedAt preserved on unpublish)
    if (post.publishedAt != null) return 'UNPUBLISHED';
    // Never published → GENERATED
    return 'GENERATED';
  }

  // Has interview answers but no generated draft
  if (interviewAnswerCount > 0) return 'INTERVIEWED';

  return 'EMPTY';
}
