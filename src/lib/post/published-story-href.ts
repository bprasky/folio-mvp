/** Use on currently public projects. A draft or missing post has no public reader. */
export function publishedStoryHref(post: { status: string; slug: string } | null) {
  return post?.status === 'PUBLISHED' && post.slug ? `/p/${encodeURIComponent(post.slug)}` : null;
}
