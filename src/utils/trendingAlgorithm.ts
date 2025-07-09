import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TrendingFactors {
  viewCount: number;
  rsvpCount: number;
  mediaCount: number;
  productScanCount: number;
  productLikeCount: number;
  productSaveCount: number;
  timeDecay: number;
  recencyBoost: number;
  featuredBoost: number;
  boostedBoost: number;
  engagementRate: number;
}

export class TrendingAlgorithm {
  // Base weights for different engagement types
  private static readonly WEIGHTS = {
    VIEW: 0.1,
    RSVP: 2.0,
    MEDIA: 1.5,
    PRODUCT_SCAN: 0.5,
    PRODUCT_LIKE: 1.0,
    PRODUCT_SAVE: 1.5,
    TIME_DECAY: 0.95, // 5% decay per day
    RECENCY_BOOST: 5.0,
    FEATURED_BOOST: 50.0,
    BOOSTED_BOOST: 30.0,
    ENGAGEMENT_RATE_MULTIPLIER: 2.0
  };

  /**
   * Calculate trending score for a sub-event
   */
  static async calculateSubEventTrendingScore(subEventId: string): Promise<number> {
    try {
      // Use raw SQL to avoid Prisma client issues
      const result = await prisma.$queryRaw`
        SELECT 
          se.*,
          COUNT(DISTINCT ser.id) as rsvp_count,
          COUNT(DISTINCT sem.id) as media_count,
          COALESCE(SUM(p.scan_count + p.like_count + p.save_count), 0) as product_engagement
        FROM sub_events se
        LEFT JOIN sub_event_rsvps ser ON se.id = ser.sub_event_id
        LEFT JOIN sub_event_media sem ON se.id = sem.sub_event_id
        LEFT JOIN sub_event_products sep ON se.id = sep.sub_event_id
        LEFT JOIN products p ON sep.product_id = p.id
        WHERE se.id = ${subEventId}
        GROUP BY se.id
      `;

      if (!result || (result as any[]).length === 0) return 0;

      const subEvent = (result as any[])[0];
      
      const factors: TrendingFactors = {
        viewCount: subEvent.view_count || 0,
        rsvpCount: parseInt(subEvent.rsvp_count) || 0,
        mediaCount: parseInt(subEvent.media_count) || 0,
        productScanCount: parseInt(subEvent.product_engagement) || 0,
        productLikeCount: 0,
        productSaveCount: 0,
        timeDecay: this.calculateTimeDecay(subEvent.created_at),
        recencyBoost: this.calculateRecencyBoost(subEvent.start_time),
        featuredBoost: subEvent.is_featured ? this.WEIGHTS.FEATURED_BOOST : 0,
        boostedBoost: subEvent.is_boosted ? this.WEIGHTS.BOOSTED_BOOST : 0,
        engagementRate: this.calculateEngagementRate(subEvent.view_count || 0, parseInt(subEvent.rsvp_count) + parseInt(subEvent.media_count))
      };

      return this.computeTrendingScore(factors);
    } catch (error) {
      console.error('Error calculating sub-event trending score:', error);
      return 0;
    }
  }

  /**
   * Calculate trending score for an event
   */
  static async calculateEventTrendingScore(eventId: string): Promise<number> {
    try {
      // Use raw SQL to avoid Prisma client issues
      const result = await prisma.$queryRaw`
        SELECT 
          e.*,
          COUNT(DISTINCT er.id) as event_rsvp_count,
          COUNT(DISTINCT em.id) as event_media_count,
          COUNT(DISTINCT ser.id) as subevent_rsvp_count,
          COUNT(DISTINCT sem.id) as subevent_media_count,
          COALESCE(SUM(p.scan_count + p.like_count + p.save_count), 0) as total_product_engagement
        FROM events e
        LEFT JOIN event_rsvps er ON e.id = er.event_id
        LEFT JOIN event_media em ON e.id = em.event_id
        LEFT JOIN sub_events se ON e.id = se.event_id
        LEFT JOIN sub_event_rsvps ser ON se.id = ser.sub_event_id
        LEFT JOIN sub_event_media sem ON se.id = sem.sub_event_id
        LEFT JOIN sub_event_products sep ON se.id = sep.sub_event_id
        LEFT JOIN products p ON sep.product_id = p.id
        WHERE e.id = ${eventId}
        GROUP BY e.id
      `;

      if (!result || (result as any[]).length === 0) return 0;

      const event = (result as any[])[0];
      
      const totalRSVPs = parseInt(event.event_rsvp_count) + parseInt(event.subevent_rsvp_count);
      const totalMedia = parseInt(event.event_media_count) + parseInt(event.subevent_media_count);
      const totalProductEngagement = parseInt(event.total_product_engagement);

      const factors: TrendingFactors = {
        viewCount: event.view_count || 0,
        rsvpCount: totalRSVPs,
        mediaCount: totalMedia,
        productScanCount: totalProductEngagement,
        productLikeCount: 0,
        productSaveCount: 0,
        timeDecay: this.calculateTimeDecay(event.created_at),
        recencyBoost: this.calculateRecencyBoost(event.start_date),
        featuredBoost: event.is_featured ? this.WEIGHTS.FEATURED_BOOST : 0,
        boostedBoost: event.is_boosted ? this.WEIGHTS.BOOSTED_BOOST : 0,
        engagementRate: this.calculateEngagementRate(event.view_count || 0, totalRSVPs + totalMedia)
      };

      return this.computeTrendingScore(factors);
    } catch (error) {
      console.error('Error calculating event trending score:', error);
      return 0;
    }
  }

  /**
   * Calculate trending score for a product
   */
  static async calculateProductTrendingScore(productId: string): Promise<number> {
    try {
      // Use raw SQL to avoid Prisma client issues
      const result = await prisma.$queryRaw`
        SELECT 
          p.*,
          COUNT(DISTINCT pt.id) as tag_count,
          COUNT(DISTINCT sep.id) as subevent_count
        FROM products p
        LEFT JOIN product_tags pt ON p.id = pt.product_id
        LEFT JOIN sub_event_products sep ON p.id = sep.product_id
        WHERE p.id = ${productId}
        GROUP BY p.id
      `;

      if (!result || (result as any[]).length === 0) return 0;

      const product = (result as any[])[0];
      
      const factors: TrendingFactors = {
        viewCount: product.view_count || 0,
        rsvpCount: 0, // Products don't have RSVPs
        mediaCount: product.media_upload_count || 0,
        productScanCount: product.scan_count || 0,
        productLikeCount: product.like_count || 0,
        productSaveCount: product.save_count || 0,
        timeDecay: this.calculateTimeDecay(product.created_at),
        recencyBoost: this.calculateProductRecencyBoost(product),
        featuredBoost: 0, // Products don't have featured status
        boostedBoost: 0, // Products don't have boost status
        engagementRate: this.calculateEngagementRate(product.view_count || 0, (product.scan_count || 0) + (product.like_count || 0) + (product.save_count || 0))
      };

      return this.computeTrendingScore(factors);
    } catch (error) {
      console.error('Error calculating product trending score:', error);
      return 0;
    }
  }

  /**
   * Calculate trending factors for a sub-event
   */
  private static async calculateTrendingFactors(subEvent: any): Promise<TrendingFactors> {
    const productEngagement = subEvent.products.reduce((sum: number, p: any) => {
      return sum + p.product.scanCount + p.product.likeCount + p.product.saveCount;
    }, 0);

    return {
      viewCount: subEvent.viewCount || 0,
      rsvpCount: subEvent.rsvps.length,
      mediaCount: subEvent.media.length,
      productScanCount: productEngagement,
      productLikeCount: 0, // Already included in productScanCount
      productSaveCount: 0, // Already included in productScanCount
      timeDecay: this.calculateTimeDecay(subEvent.createdAt),
      recencyBoost: this.calculateRecencyBoost(subEvent.startTime),
      featuredBoost: subEvent.isFeatured ? this.WEIGHTS.FEATURED_BOOST : 0,
      boostedBoost: subEvent.isBoosted ? this.WEIGHTS.BOOSTED_BOOST : 0,
      engagementRate: this.calculateEngagementRate(subEvent.viewCount || 0, subEvent.rsvps.length + subEvent.media.length)
    };
  }

  /**
   * Compute final trending score from factors
   */
  private static computeTrendingScore(factors: TrendingFactors): number {
    let score = 0;

    // Base engagement scores
    score += factors.viewCount * this.WEIGHTS.VIEW;
    score += factors.rsvpCount * this.WEIGHTS.RSVP;
    score += factors.mediaCount * this.WEIGHTS.MEDIA;
    score += factors.productScanCount * this.WEIGHTS.PRODUCT_SCAN;
    score += factors.productLikeCount * this.WEIGHTS.PRODUCT_LIKE;
    score += factors.productSaveCount * this.WEIGHTS.PRODUCT_SAVE;

    // Apply time decay
    score *= factors.timeDecay;

    // Add boosts
    score += factors.recencyBoost;
    score += factors.featuredBoost;
    score += factors.boostedBoost;

    // Apply engagement rate multiplier
    if (factors.engagementRate > 0.1) { // 10% engagement rate threshold
      score *= this.WEIGHTS.ENGAGEMENT_RATE_MULTIPLIER;
    }

    return Math.round(score);
  }

  /**
   * Calculate time decay factor
   */
  private static calculateTimeDecay(createdAt: Date): number {
    const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return Math.pow(this.WEIGHTS.TIME_DECAY, daysSinceCreation);
  }

  /**
   * Calculate recency boost for events
   */
  private static calculateRecencyBoost(startTime: Date): number {
    const now = new Date();
    const daysUntilEvent = Math.ceil((startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilEvent >= 0 && daysUntilEvent <= 7) {
      return (7 - daysUntilEvent) * this.WEIGHTS.RECENCY_BOOST;
    }
    
    return 0;
  }

  /**
   * Calculate recency boost for products
   */
  private static calculateProductRecencyBoost(product: any): number {
    // Products get a boost if they're recently created or have recent activity
    const daysSinceCreation = (Date.now() - product.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreation <= 30) { // First 30 days
      return (30 - daysSinceCreation) * 0.5;
    }
    
    return 0;
  }

  /**
   * Calculate engagement rate
   */
  private static calculateEngagementRate(views: number, engagements: number): number {
    if (views === 0) return 0;
    return engagements / views;
  }

  /**
   * Update trending scores for all sub-events
   */
  static async updateAllSubEventTrendingScores(): Promise<void> {
    try {
      const subEvents = await prisma.subEvent.findMany({
        select: { id: true }
      });

      for (const subEvent of subEvents) {
        const score = await this.calculateSubEventTrendingScore(subEvent.id);
        await prisma.subEvent.update({
          where: { id: subEvent.id },
          data: { trendingScore: score }
        });
      }
    } catch (error) {
      console.error('Error updating all sub-event trending scores:', error);
    }
  }

  /**
   * Update trending scores for all events
   */
  static async updateAllEventTrendingScores(): Promise<void> {
    try {
      const events = await prisma.event.findMany({
        select: { id: true }
      });

      for (const event of events) {
        const score = await this.calculateEventTrendingScore(event.id);
        await prisma.event.update({
          where: { id: event.id },
          data: { trendingScore: score }
        });
      }
    } catch (error) {
      console.error('Error updating all event trending scores:', error);
    }
  }

  /**
   * Get trending sub-events
   */
  static async getTrendingSubEvents(limit: number = 10): Promise<any[]> {
    try {
      return await prisma.subEvent.findMany({
        where: {
          isPrivate: false,
          trendingScore: {
            gt: 0
          }
        },
        include: {
          event: {
            select: {
              id: true,
              title: true
            }
          }
        },
        orderBy: {
          trendingScore: 'desc'
        },
        take: limit
      });
    } catch (error) {
      console.error('Error fetching trending sub-events:', error);
      return [];
    }
  }

  /**
   * Get trending events
   */
  static async getTrendingEvents(limit: number = 10): Promise<any[]> {
    try {
      return await prisma.event.findMany({
        where: {
          trendingScore: {
            gt: 0
          }
        },
        orderBy: {
          trendingScore: 'desc'
        },
        take: limit
      });
    } catch (error) {
      console.error('Error fetching trending events:', error);
      return [];
    }
  }
} 