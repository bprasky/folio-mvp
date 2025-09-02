/**
 * Safely adds query parameters to a URL, preserving existing parameters and anchors
 */
export function addQueryParams(url: string, params: Record<string, string | number | boolean>): string {
  try {
    const urlObj = new URL(url);
    
    // Add new parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        urlObj.searchParams.set(key, String(value));
      }
    });
    
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, try to append parameters manually
    console.warn('Failed to parse URL, appending parameters manually:', error);
    
    const separator = url.includes('?') ? '&' : '?';
    const paramString = Object.entries(params)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    
    return paramString ? `${url}${separator}${paramString}` : url;
  }
}

/**
 * Converts a string to a URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generates an affiliate URL with UTM parameters
 */
export function generateAffiliateUrl(
  baseUrl: string, 
  designerId: string, 
  postTitle: string,
  utmSource: string = 'folio',
  utmMedium: string = 'designer'
): string {
  const params = {
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: slugify(postTitle),
    aff: designerId
  };
  
  return addQueryParams(baseUrl, params);
}

/**
 * Validates if a string is a valid URL
 */
export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Extracts domain from URL for display purposes
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}
