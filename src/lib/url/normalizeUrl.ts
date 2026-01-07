/**
 * URL normalization utilities for image scraping and validation
 */

/**
 * Normalize a URL to absolute format with validation
 * @param input Raw URL string (may be relative, protocol-relative, or absolute)
 * @param base Base URL for resolving relative paths
 * @returns Normalized absolute URL or null if invalid
 */
export function normalizeUrl(input?: string | null, base?: string | URL): string | null {
  if (!input) return null;
  
  let s = input.trim();

  // Handle concatenated URLs (take first one)
  const parts = s.split(/(?=https?:\/\/)/g).filter(Boolean);
  if (parts.length > 1) {
    console.warn('⚠️ Detected concatenated URLs, taking first:', s.substring(0, 100));
    s = parts[0];
  }

  // Remove double protocol patterns (https://cdnhttps://)
  const doubleProtocol = s.match(/(https?:\/\/)\w+(https?:\/\/)/i);
  if (doubleProtocol) {
    console.warn('⚠️ Removing double protocol from:', s.substring(0, 100));
    s = s.replace(/(https?:\/\/)\w+(https?:\/\/)/i, '$2');
  }

  // Protocol-relative → https
  if (s.startsWith('//')) {
    s = 'https:' + s;
  }

  // Make absolute if relative
  try {
    const url = new URL(s, base);
    
    // Only allow http(s) protocols
    if (!/^https?:$/i.test(url.protocol)) {
      console.warn('⚠️ Invalid protocol:', url.protocol, 'from:', s.substring(0, 100));
      return null;
    }
    
    return url.toString();
  } catch (error) {
    console.warn('⚠️ Failed to parse URL:', s.substring(0, 100));
    return null;
  }
}

/**
 * Parse srcset attribute and return the largest image URL
 * @param srcset Srcset string (e.g., "image1.jpg 480w, image2.jpg 1280w, image3.jpg 2x")
 * @param base Base URL for resolving relative paths
 * @returns Largest image URL or null
 */
export function pickLargestFromSrcset(srcset?: string | null, base?: string | URL): string | null {
  if (!srcset) return null;

  try {
    // Parse srcset format: "url 480w, url 1280w, url 2x"
    const candidates = srcset
      .split(',')
      .map(entry => {
        const trimmed = entry.trim();
        
        // Match patterns like: "url 480w" or "url 2x"
        const match = trimmed.match(/^(.+?)\s+(\d+)(w|x)$/i);
        
        if (match) {
          const url = normalizeUrl(match[1].trim(), base);
          const size = parseInt(match[2], 10);
          const unit = match[3].toLowerCase();
          
          // Convert density descriptors to approximate pixel width
          const pixelSize = unit === 'x' ? size * 1000 : size;
          
          return url ? { url, size: pixelSize } : null;
        }
        
        // No descriptor, just URL
        const url = normalizeUrl(trimmed, base);
        return url ? { url, size: 0 } : null;
      })
      .filter((c): c is { url: string; size: number } => c !== null);

    if (candidates.length === 0) return null;

    // Sort by size descending and return largest
    candidates.sort((a, b) => b.size - a.size);
    return candidates[0].url;
  } catch (error) {
    console.warn('⚠️ Failed to parse srcset:', srcset.substring(0, 100));
    return null;
  }
}

/**
 * Validate that a URL is a valid image URL
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Must be http(s)
    if (!/^https?:$/i.test(parsed.protocol)) {
      return false;
    }
    
    // Check for common image extensions (optional - CDNs may not have extensions)
    const hasImageExt = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i.test(parsed.pathname);
    const isCdn = /cdn|cloudinary|imgix|cloudfront|unsplash/i.test(parsed.hostname);
    
    // Accept if has image extension OR is from known CDN
    return hasImageExt || isCdn;
  } catch {
    return false;
  }
}

/**
 * Validate and clean a list of image URLs
 */
export function validateImageList(urls?: string[]): string[] {
  if (!urls || !Array.isArray(urls)) return [];
  
  return urls
    .map(url => normalizeUrl(url))
    .filter((url): url is string => url !== null && isValidImageUrl(url));
}




