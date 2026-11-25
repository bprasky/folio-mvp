import type { ImportedProject, WorkspaceImport } from './types';

const genericTitle = /^(?:(?:view|see|explore|open)(?:\s+(?:the|this))?\s+)?(?:work|projects?|portfolio|gallery|photos?|images?)$|^(?:view|see|read|learn) more$|^imported project$/i;
const readableSlug = new RegExp("^[\\p{L}][\\p{L}\\p{N} '’]*$", 'u');
const compact = (value: string) => value.toLowerCase().replace(/[\s.'’&_-]+/g, '');

/** Portfolio indexes often name the work even when every gallery uses the studio masthead. */
export function importProjectTitle(run: Pick<WorkspaceImport, 'orgName'>, url: string, pageTitle: string, label?: string) {
  const source = new URL(url);
  const studio = compact(run.orgName);
  const host = compact(source.hostname.replace(/^www\./i, '').split('.')[0]);
  const meaningful = (value: string) => {
    const name = compact(value);
    return name && name !== studio && name !== host && !genericTitle.test(value.trim());
  };
  if (meaningful(pageTitle)) return pageTitle;
  if (label && meaningful(label)) return label;
  const slug = source.pathname.split('/').filter(Boolean).pop() || '';
  // Human-readable slugs can recover older imports which did not save link labels.
  try {
    const words = decodeURIComponent(slug).replace(/\.(?:html?|aspx?)$/i, '').replace(/[-_]+/g, ' ').trim();
    if (words.length <= 160 && readableSlug.test(words) && !/^[a-f0-9-]{8,}$/i.test(slug) && meaningful(words)) {
      return words.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
  } catch { /* A malformed URL segment cannot supply a display name. */ }
  return pageTitle || 'Imported project';
}

export function reviewProjectTitle(run: WorkspaceImport, project: { title: string }, source?: ImportedProject) {
  if (!source || project.title !== source.title) return project.title;
  return importProjectTitle(run, source.url, source.title);
}
