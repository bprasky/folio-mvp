/** Navigation intent is untrusted UI context, never evidence or authorization. */
export function expertiseIntent(topic: unknown, projects: unknown) {
  const text = typeof topic === 'string' ? topic.trim().slice(0, 240) : '';
  const ids = typeof projects === 'string' ? Array.from(new Set(projects.split(',').filter(id => /^[a-zA-Z0-9_-]{1,100}$/.test(id)))).slice(0, 8) : [];
  return { topic: text, projectIds: ids };
}

export function expertiseReturnUrl(intent: ReturnType<typeof expertiseIntent>, projectId?: string) {
  const ids = Array.from(new Set([...intent.projectIds, ...(projectId ? [projectId] : [])]));
  const query = new URLSearchParams({ expertiseTopic: intent.topic, expertiseProjects: ids.join(',') });
  return `/designer/studio?${query}#my-expertise`;
}
