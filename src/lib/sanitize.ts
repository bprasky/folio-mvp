/**
 * Basic HTML sanitizer to prevent XSS in user-generated content.
 * Strips all HTML tags except safe formatting tags.
 * Use this before rendering user or AI-generated HTML with dangerouslySetInnerHTML.
 */

const SAFE_TAGS = new Set([
  'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'span', 'div', 'img', 'figure', 'figcaption', 'table', 'thead',
  'tbody', 'tr', 'th', 'td', 'hr', 'sup', 'sub',
]);

const SAFE_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'class', 'id', 'width', 'height',
  'target', 'rel', 'colspan', 'rowspan',
]);

/**
 * Sanitize HTML by stripping unsafe tags and attributes.
 * Removes script, style, iframe, object, embed, form, input, and event handlers.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  // Remove script and style tags with their content
  let clean = dirty
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/<input[^>]*>/gi, '')
    .replace(/<textarea\b[^<]*(?:(?!<\/textarea>)<[^<]*)*<\/textarea>/gi, '')
    .replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, '')
    .replace(/<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>/gi, '');

  // Remove event handler attributes (on*)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');
  clean = clean.replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');
  clean = clean.replace(/href\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi, '');

  // Remove any remaining tags that aren't in the safe list
  clean = clean.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
    if (SAFE_TAGS.has(tag.toLowerCase())) {
      // For safe tags, still strip unsafe attributes
      return match.replace(/\s+([a-zA-Z-]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/g, (attrMatch, attrName) => {
        if (SAFE_ATTRS.has(attrName.toLowerCase())) {
          return attrMatch;
        }
        return '';
      });
    }
    return ''; // Strip unsafe tags
  });

  return clean;
}
