import axios from 'axios';

interface ImageSearchResult {
  url: string;
  title: string;
  width: number;
  height: number;
  source: string;
}

interface SearchContext {
  type: 'event' | 'vendor' | 'product' | 'location';
  name: string;
  description?: string;
  location?: string;
  category?: string;
  brand?: string;
}

export class SmartImageSearch {
  private static readonly UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
  private static readonly PEXELS_API_KEY = process.env.PEXELS_API_KEY;
  private static readonly GOOGLE_CUSTOM_SEARCH_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  private static readonly GOOGLE_CUSTOM_SEARCH_ENGINE_ID = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

  /**
   * Intelligently search for images based on context
   */
  static async searchImages(context: SearchContext): Promise<ImageSearchResult[]> {
    try {
      const searchQuery = this.buildSearchQuery(context);
      console.log(`🔍 Smart image search for: ${searchQuery}`);

      // Try multiple sources for better results
      const results = await Promise.allSettled([
        this.searchUnsplash(searchQuery, context.type),
        this.searchPexels(searchQuery, context.type),
        this.searchGoogleImages(searchQuery, context.type)
      ]);

      // Combine and deduplicate results
      const allResults: ImageSearchResult[] = [];
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          allResults.push(...result.value);
        }
      });

      // Sort by relevance and quality
      return this.rankResults(allResults, context);
    } catch (error) {
      console.error('Smart image search failed:', error);
      return [];
    }
  }

  /**
   * Auto-populate missing images for events, vendors, or products
   */
  static async autoPopulateImages(
    entity: any, 
    entityType: 'event' | 'vendor' | 'product'
  ): Promise<{ [key: string]: string }> {
    const context = this.buildContext(entity, entityType);
    const images = await this.searchImages(context);
    
    if (images.length === 0) return {};

    const populatedImages: { [key: string]: string } = {};

    switch (entityType) {
      case 'event':
        populatedImages.banner = images[0]?.url || '';
        populatedImages.thumbnail = images[1]?.url || images[0]?.url || '';
        break;
      
      case 'vendor':
        populatedImages.logo = images.find(img => 
          img.title.toLowerCase().includes('logo') || 
          img.width === img.height
        )?.url || images[0]?.url || '';
        populatedImages.banner = images.find(img => 
          img.width > img.height && img.width >= 1200
        )?.url || images[0]?.url || '';
        break;
      
      case 'product':
        populatedImages.imageUrl = images[0]?.url || '';
        populatedImages.thumbnail = images[1]?.url || images[0]?.url || '';
        break;
    }

    return populatedImages;
  }

  /**
   * Build intelligent search query based on context
   */
  private static buildSearchQuery(context: SearchContext): string {
    let query = '';

    switch (context.type) {
      case 'event':
        query = `${context.name} ${context.location || ''} ${context.description || ''}`.trim();
        // Add event-specific keywords
        if (context.name.toLowerCase().includes('dinner')) query += ' restaurant interior design';
        if (context.name.toLowerCase().includes('showcase')) query += ' product showcase design';
        if (context.name.toLowerCase().includes('panel')) query += ' conference room design';
        break;

      case 'vendor':
        query = `${context.name} ${context.brand || ''} logo brand design`;
        break;

      case 'product':
        query = `${context.name} ${context.brand || ''} ${context.category || ''} product photography`;
        break;

      case 'location':
        query = `${context.name} ${context.location || ''} interior architecture design`;
        break;
    }

    // Clean up the query
    return query
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200); // Limit query length
  }

  /**
   * Build context from entity data
   */
  private static buildContext(entity: any, entityType: string): SearchContext {
    switch (entityType) {
      case 'event':
        return {
          type: 'event',
          name: entity.title || entity.name || '',
          description: entity.description || '',
          location: entity.location || entity.address || '',
          category: entity.type || 'event'
        };

      case 'vendor':
        return {
          type: 'vendor',
          name: entity.name || entity.companyName || '',
          description: entity.description || '',
          brand: entity.brand || entity.name || ''
        };

      case 'product':
        return {
          type: 'product',
          name: entity.name || '',
          description: entity.description || '',
          category: entity.category || '',
          brand: entity.brand || ''
        };

      default:
        return {
          type: 'location',
          name: entity.name || entity.title || '',
          location: entity.location || entity.address || ''
        };
    }
  }

  /**
   * Search Unsplash API
   */
  private static async searchUnsplash(query: string, type: string): Promise<ImageSearchResult[]> {
    if (!this.UNSPLASH_ACCESS_KEY) return [];

    try {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        headers: {
          'Authorization': `Client-ID ${this.UNSPLASH_ACCESS_KEY}`
        },
        params: {
          query,
          per_page: 10,
          orientation: type === 'vendor' ? 'squarish' : 'landscape'
        }
      });

      return response.data.results.map((photo: any) => ({
        url: photo.urls.regular,
        title: photo.description || photo.alt_description || '',
        width: photo.width,
        height: photo.height,
        source: 'unsplash'
      }));
    } catch (error) {
      console.error('Unsplash search failed:', error);
      return [];
    }
  }

  /**
   * Search Pexels API
   */
  private static async searchPexels(query: string, type: string): Promise<ImageSearchResult[]> {
    if (!this.PEXELS_API_KEY) return [];

    try {
      const response = await axios.get('https://api.pexels.com/v1/search', {
        headers: {
          'Authorization': this.PEXELS_API_KEY
        },
        params: {
          query,
          per_page: 10,
          orientation: type === 'vendor' ? 'square' : 'landscape'
        }
      });

      return response.data.photos.map((photo: any) => ({
        url: photo.src.large,
        title: photo.alt || '',
        width: photo.width,
        height: photo.height,
        source: 'pexels'
      }));
    } catch (error) {
      console.error('Pexels search failed:', error);
      return [];
    }
  }

  /**
   * Search Google Custom Search API
   */
  private static async searchGoogleImages(query: string, type: string): Promise<ImageSearchResult[]> {
    if (!this.GOOGLE_CUSTOM_SEARCH_API_KEY || !this.GOOGLE_CUSTOM_SEARCH_ENGINE_ID) return [];

    try {
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: this.GOOGLE_CUSTOM_SEARCH_API_KEY,
          cx: this.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
          q: query,
          searchType: 'image',
          num: 10,
          imgSize: type === 'vendor' ? 'medium' : 'large',
          imgType: 'photo'
        }
      });

      return (response.data.items || []).map((item: any) => ({
        url: item.link,
        title: item.title || '',
        width: parseInt(item.image?.width || '0'),
        height: parseInt(item.image?.height || '0'),
        source: 'google'
      }));
    } catch (error) {
      console.error('Google search failed:', error);
      return [];
    }
  }

  /**
   * Rank results by relevance and quality
   */
  private static rankResults(results: ImageSearchResult[], context: SearchContext): ImageSearchResult[] {
    return results
      .filter(result => {
        // Filter out low-quality images
        if (result.width < 400 || result.height < 300) return false;
        
        // Filter out images that are too small for their intended use
        if (context.type === 'vendor' && result.width < 200) return false;
        if (context.type === 'event' && result.width < 800) return false;
        
        return true;
      })
      .sort((a, b) => {
        // Prefer higher resolution images
        const aScore = a.width * a.height;
        const bScore = b.width * b.height;
        
        // Prefer images from certain sources
        const aSourceScore = a.source === 'unsplash' ? 1 : a.source === 'pexels' ? 0.8 : 0.6;
        const bSourceScore = b.source === 'unsplash' ? 1 : b.source === 'pexels' ? 0.8 : 0.6;
        
        return (bScore * bSourceScore) - (aScore * aSourceScore);
      })
      .slice(0, 5); // Return top 5 results
  }

  /**
   * Get a single best image for immediate use
   */
  static async getBestImage(context: SearchContext): Promise<string | null> {
    const results = await this.searchImages(context);
    return results[0]?.url || null;
  }
} 