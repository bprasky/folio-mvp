export type VendorTier = "affiliate" | "lite" | "preferred" | "enterprise";

export interface VendorSummary {
  vendorId: string;
  name: string;
  primaryCategory: string; // e.g., "Stone", "Furniture"
  accountTier: VendorTier;
  hqCity: string;
  hqCountry: string;
}

export interface Product {
  productId: string;
  vendorId: string;
  name: string;
  skuCode: string;
  collectionName: string;
  category: string; // "Slab", "Tile", "Sconce", etc.
  material: string;
  finish: string;
  colorFamily: string;
  priceRetail: number;
  isActive: boolean;
}

export interface ProductStats {
  productId: string;
  views: number;
  saves: number;
  tags: number;
  specIntentEvents: number; // "we're specifying this"
  avgProjectBudgetInfluenced: number; // mean budget of projects where tagged
  last30DaysTrendScore: number; // -1 to +1 for momentum
}

export interface Designer {
  designerId: string;
  name: string;
  firmName: string;
  primaryLocationCity: string;
  primaryLocationCountry: string;
  designerTier: "emerging" | "established" | "flagship";
  specialties: string[]; // ["Residential", "Hospitality"]
  styleTags: string[]; // ["Modern", "Transitional", ...]
}

export interface DesignerEngagement {
  designerId: string;
  totalViews: number;
  totalSaves: number;
  totalTags: number;
  totalSpecIntentEvents: number;
  activeProjectCount: number;
  influencedProjectBudget: number;
  lastInteractionAt: string; // ISO
  alignmentScore: number; // 0-1, higher = strong alignment
}

export interface EventSummary {
  eventId: string;
  name: string;
  eventType: string; // "Trade Show", "Design Week"
  city: string;
  country: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  vendorBoothCost: number;
  vendorTravelCostEstimate: number;
  vendorSponsorshipCost: number;
}

export interface EventStats {
  eventId: string;
  designerRsvps: number;
  designerCheckins: number;
  productViewsAtEvent: number;
  productSavesAtEvent: number;
  productTagsAttributedToEvent: number;
  influencedPipelineBudget: number; // sum of project budgets where event was meaningful touch
}

export interface ProjectSummary {
  projectId: string;
  designerId: string;
  name: string;
  projectType: string; // "Residential", ...
  estimatedBudgetTotal: number;
  status: "concept" | "active" | "on_hold" | "completed";
  locationCity: string;
  locationCountry: string;
  startDate?: string;
  targetCompletionDate?: string;
}

export interface ProjectInfluenceStats {
  projectId: string;
  vendorInfluenceValue: number; // portion of budget where vendor's products are tagged
  taggedProductsCount: number;
  specIntentCount: number;
}

export interface QuestionLogEntry {
  id: string;
  vendorId: string;
  questionText: string;
  normalizedType?: string;
  createdAt: string;
}

export interface VendorAnalyticsData {
  vendor: VendorSummary;
  products: Product[];
  productStats: ProductStats[];
  designers: Designer[];
  designerEngagement: DesignerEngagement[];
  events: EventSummary[];
  eventStats: EventStats[];
  projects: ProjectSummary[];
  projectInfluenceStats: ProjectInfluenceStats[];
  questionLog: QuestionLogEntry[];
}

export const mockVendorAnalyticsData: VendorAnalyticsData = {
  vendor: {
    vendorId: "vendor-ondulato-001",
    name: "Ondulato Stone Co.",
    primaryCategory: "Stone",
    accountTier: "preferred",
    hqCity: "New York",
    hqCountry: "United States",
  },
  products: [
    // Premium Marble Collection - Slabs
    {
      productId: "prod-001",
      vendorId: "vendor-ondulato-001",
      name: "Calacatta Gold Vein Slab",
      skuCode: "OND-CGV-001",
      collectionName: "Premium Marble",
      category: "Slab",
      material: "Marble",
      finish: "Polished",
      colorFamily: "White",
      priceRetail: 125.00,
      isActive: true,
    },
    {
      productId: "prod-002",
      vendorId: "vendor-ondulato-001",
      name: "Calacatta Vagli Slab",
      skuCode: "OND-CV-002",
      collectionName: "Premium Marble",
      category: "Slab",
      material: "Marble",
      finish: "Polished",
      colorFamily: "White",
      priceRetail: 135.00,
      isActive: true,
    },
    {
      productId: "prod-003",
      vendorId: "vendor-ondulato-001",
      name: "Nero Marquina Slab",
      skuCode: "OND-NM-003",
      collectionName: "Premium Marble",
      category: "Slab",
      material: "Marble",
      finish: "Polished",
      colorFamily: "Black",
      priceRetail: 95.00,
      isActive: true,
    },
    {
      productId: "prod-004",
      vendorId: "vendor-ondulato-001",
      name: "Statuario Venato Slab",
      skuCode: "OND-SV-004",
      collectionName: "Premium Marble",
      category: "Slab",
      material: "Marble",
      finish: "Polished",
      colorFamily: "White",
      priceRetail: 155.00,
      isActive: true,
    },
    {
      productId: "prod-005",
      vendorId: "vendor-ondulato-001",
      name: "Emperador Dark Slab",
      skuCode: "OND-ED-005",
      collectionName: "Premium Marble",
      category: "Slab",
      material: "Marble",
      finish: "Polished",
      colorFamily: "Brown",
      priceRetail: 110.00,
      isActive: true,
    },
    {
      productId: "prod-006",
      vendorId: "vendor-ondulato-001",
      name: "Quartzite Blue Slab",
      skuCode: "OND-QB-006",
      collectionName: "Exotic Collection",
      category: "Slab",
      material: "Quartzite",
      finish: "Polished",
      colorFamily: "Blue",
      priceRetail: 145.00,
      isActive: true,
    },
    // Classic Collection - Tiles
    {
      productId: "prod-007",
      vendorId: "vendor-ondulato-001",
      name: "Carrara Classic Tile",
      skuCode: "OND-CC-12x24",
      collectionName: "Classic Collection",
      category: "Tile",
      material: "Marble",
      finish: "Honed",
      colorFamily: "White",
      priceRetail: 18.50,
      isActive: true,
    },
    {
      productId: "prod-008",
      vendorId: "vendor-ondulato-001",
      name: "Carrara Hexagon Mosaic",
      skuCode: "OND-CH-HEX",
      collectionName: "Classic Collection",
      category: "Tile",
      material: "Marble",
      finish: "Polished",
      colorFamily: "White",
      priceRetail: 22.00,
      isActive: true,
    },
    {
      productId: "prod-009",
      vendorId: "vendor-ondulato-001",
      name: "Carrara Subway Tile",
      skuCode: "OND-CS-3x12",
      collectionName: "Classic Collection",
      category: "Tile",
      material: "Marble",
      finish: "Honed",
      colorFamily: "White",
      priceRetail: 16.75,
      isActive: true,
    },
    {
      productId: "prod-010",
      vendorId: "vendor-ondulato-001",
      name: "Nero Marquina Hexagon",
      skuCode: "OND-NMH-HEX",
      collectionName: "Classic Collection",
      category: "Tile",
      material: "Marble",
      finish: "Polished",
      colorFamily: "Black",
      priceRetail: 24.50,
      isActive: true,
    },
    // Natural Stone Collection - Tiles
    {
      productId: "prod-011",
      vendorId: "vendor-ondulato-001",
      name: "Travertine Beige Tile",
      skuCode: "OND-TB-16x16",
      collectionName: "Natural Stone",
      category: "Tile",
      material: "Travertine",
      finish: "Tumbled",
      colorFamily: "Beige",
      priceRetail: 12.75,
      isActive: true,
    },
    {
      productId: "prod-012",
      vendorId: "vendor-ondulato-001",
      name: "Limestone Cream Tile",
      skuCode: "OND-LC-12x12",
      collectionName: "Natural Stone",
      category: "Tile",
      material: "Limestone",
      finish: "Brushed",
      colorFamily: "Cream",
      priceRetail: 15.25,
      isActive: true,
    },
    {
      productId: "prod-013",
      vendorId: "vendor-ondulato-001",
      name: "Travertine Silver Tile",
      skuCode: "OND-TS-12x24",
      collectionName: "Natural Stone",
      category: "Tile",
      material: "Travertine",
      finish: "Honed",
      colorFamily: "Gray",
      priceRetail: 14.50,
      isActive: true,
    },
    // Exotic Collection - Slabs
    {
      productId: "prod-014",
      vendorId: "vendor-ondulato-001",
      name: "Onyx Amber Slab",
      skuCode: "OND-OA-014",
      collectionName: "Exotic Collection",
      category: "Slab",
      material: "Onyx",
      finish: "Polished",
      colorFamily: "Amber",
      priceRetail: 185.00,
      isActive: false, // Lagging product
    },
    {
      productId: "prod-015",
      vendorId: "vendor-ondulato-001",
      name: "Quartzite Fantasy Brown Slab",
      skuCode: "OND-QFB-015",
      collectionName: "Exotic Collection",
      category: "Slab",
      material: "Quartzite",
      finish: "Polished",
      colorFamily: "Brown",
      priceRetail: 165.00,
      isActive: true,
    },
    // Other - Mosaics/Trims
    {
      productId: "prod-016",
      vendorId: "vendor-ondulato-001",
      name: "Carrara Penny Round Mosaic",
      skuCode: "OND-CPR-MOS",
      collectionName: "Classic Collection",
      category: "Other",
      material: "Marble",
      finish: "Polished",
      colorFamily: "White",
      priceRetail: 28.00,
      isActive: true,
    },
    {
      productId: "prod-017",
      vendorId: "vendor-ondulato-001",
      name: "Marble Bullnose Trim",
      skuCode: "OND-MB-TRIM",
      collectionName: "Classic Collection",
      category: "Other",
      material: "Marble",
      finish: "Polished",
      colorFamily: "White",
      priceRetail: 35.00,
      isActive: true,
    },
  ],
  productStats: [
    {
      productId: "prod-001",
      views: 1240,
      saves: 342,
      tags: 89,
      specIntentEvents: 23,
      avgProjectBudgetInfluenced: 485000,
      last30DaysTrendScore: 0.85, // Hero product - strong upward trend
    },
    {
      productId: "prod-002",
      views: 980,
      saves: 289,
      tags: 72,
      specIntentEvents: 19,
      avgProjectBudgetInfluenced: 520000,
      last30DaysTrendScore: 0.75, // Strong trend
    },
    {
      productId: "prod-003",
      views: 1120,
      saves: 267,
      tags: 67,
      specIntentEvents: 18,
      avgProjectBudgetInfluenced: 410000,
      last30DaysTrendScore: 0.55,
    },
    {
      productId: "prod-004",
      views: 1450,
      saves: 412,
      tags: 98,
      specIntentEvents: 28,
      avgProjectBudgetInfluenced: 580000,
      last30DaysTrendScore: 0.82, // High views, high saves - hidden gem
    },
    {
      productId: "prod-005",
      views: 890,
      saves: 198,
      tags: 45,
      specIntentEvents: 12,
      avgProjectBudgetInfluenced: 320000,
      last30DaysTrendScore: 0.35,
    },
    {
      productId: "prod-006",
      views: 980,
      saves: 234,
      tags: 58,
      specIntentEvents: 15,
      avgProjectBudgetInfluenced: 520000,
      last30DaysTrendScore: 0.65,
    },
    {
      productId: "prod-007",
      views: 890,
      saves: 198,
      tags: 45,
      specIntentEvents: 12,
      avgProjectBudgetInfluenced: 320000,
      last30DaysTrendScore: 0.40,
    },
    {
      productId: "prod-008",
      views: 650,
      saves: 156,
      tags: 38,
      specIntentEvents: 9,
      avgProjectBudgetInfluenced: 280000,
      last30DaysTrendScore: 0.25,
    },
    {
      productId: "prod-009",
      views: 720,
      saves: 178,
      tags: 42,
      specIntentEvents: 10,
      avgProjectBudgetInfluenced: 290000,
      last30DaysTrendScore: 0.30,
    },
    {
      productId: "prod-010",
      views: 580,
      saves: 145,
      tags: 34,
      specIntentEvents: 8,
      avgProjectBudgetInfluenced: 240000,
      last30DaysTrendScore: 0.20,
    },
    {
      productId: "prod-011",
      views: 650,
      saves: 98,
      tags: 21,
      specIntentEvents: 5,
      avgProjectBudgetInfluenced: 180000,
      last30DaysTrendScore: -0.15,
    },
    {
      productId: "prod-012",
      views: 720,
      saves: 145,
      tags: 32,
      specIntentEvents: 8,
      avgProjectBudgetInfluenced: 250000,
      last30DaysTrendScore: 0.10,
    },
    {
      productId: "prod-013",
      views: 520,
      saves: 78,
      tags: 18,
      specIntentEvents: 4,
      avgProjectBudgetInfluenced: 160000,
      last30DaysTrendScore: -0.10,
    },
    {
      productId: "prod-014",
      views: 180,
      saves: 12,
      tags: 3,
      specIntentEvents: 1,
      avgProjectBudgetInfluenced: 95000,
      last30DaysTrendScore: -0.75, // Strong negative trend - lagging product
    },
    {
      productId: "prod-015",
      views: 1100,
      saves: 298,
      tags: 76,
      specIntentEvents: 21,
      avgProjectBudgetInfluenced: 540000,
      last30DaysTrendScore: 0.70,
    },
    {
      productId: "prod-016",
      views: 420,
      saves: 89,
      tags: 22,
      specIntentEvents: 6,
      avgProjectBudgetInfluenced: 190000,
      last30DaysTrendScore: 0.05,
    },
    {
      productId: "prod-017",
      views: 380,
      saves: 67,
      tags: 16,
      specIntentEvents: 4,
      avgProjectBudgetInfluenced: 150000,
      last30DaysTrendScore: -0.05,
    },
  ],
  designers: [
    {
      designerId: "designer-001",
      name: "Sarah Chen",
      firmName: "Chen & Associates",
      primaryLocationCity: "New York",
      primaryLocationCountry: "United States",
      designerTier: "flagship",
      specialties: ["Residential", "Hospitality"],
      styleTags: ["Modern", "Minimalist"],
    },
    {
      designerId: "designer-002",
      name: "Marcus Rodriguez",
      firmName: "Rodriguez Design Studio",
      primaryLocationCity: "Los Angeles",
      primaryLocationCountry: "United States",
      designerTier: "established",
      specialties: ["Residential"],
      styleTags: ["Transitional", "Contemporary"],
    },
    {
      designerId: "designer-003",
      name: "Emma Thompson",
      firmName: "Thompson Interiors",
      primaryLocationCity: "London",
      primaryLocationCountry: "United Kingdom",
      designerTier: "flagship",
      specialties: ["Residential", "Commercial"],
      styleTags: ["Classic", "Luxury"],
    },
    {
      designerId: "designer-004",
      name: "James Park",
      firmName: "Park Design Collective",
      primaryLocationCity: "San Francisco",
      primaryLocationCountry: "United States",
      designerTier: "established",
      specialties: ["Residential"],
      styleTags: ["Modern", "Sustainable"],
    },
    {
      designerId: "designer-005",
      name: "Isabella Martinez",
      firmName: "Martinez Studio",
      primaryLocationCity: "Miami",
      primaryLocationCountry: "United States",
      designerTier: "emerging",
      specialties: ["Residential"],
      styleTags: ["Tropical", "Contemporary"],
    },
    {
      designerId: "designer-006",
      name: "David Kim",
      firmName: "Kim Architecture",
      primaryLocationCity: "Seattle",
      primaryLocationCountry: "United States",
      designerTier: "established",
      specialties: ["Residential", "Commercial"],
      styleTags: ["Modern", "Minimalist"],
    },
    {
      designerId: "designer-007",
      name: "Sophie Laurent",
      firmName: "Laurent Design",
      primaryLocationCity: "Paris",
      primaryLocationCountry: "France",
      designerTier: "flagship",
      specialties: ["Residential", "Hospitality"],
      styleTags: ["Classic", "Luxury"],
    },
    {
      designerId: "designer-008",
      name: "Alex Johnson",
      firmName: "Johnson Interiors",
      primaryLocationCity: "Chicago",
      primaryLocationCountry: "United States",
      designerTier: "emerging",
      specialties: ["Residential"],
      styleTags: ["Transitional", "Modern"],
    },
    {
      designerId: "designer-009",
      name: "Rachel Williams",
      firmName: "Williams & Co.",
      primaryLocationCity: "Austin",
      primaryLocationCountry: "United States",
      designerTier: "established",
      specialties: ["Residential", "Hospitality"],
      styleTags: ["Warm Modern", "Eclectic"],
    },
    {
      designerId: "designer-010",
      name: "Michael Chen",
      firmName: "Chen Design Group",
      primaryLocationCity: "New York",
      primaryLocationCountry: "United States",
      designerTier: "flagship",
      specialties: ["Residential", "Commercial"],
      styleTags: ["Maximalist", "Bold"],
    },
  ],
  designerEngagement: [
    {
      designerId: "designer-001",
      totalViews: 1240,
      totalSaves: 342,
      totalTags: 89,
      totalSpecIntentEvents: 23,
      activeProjectCount: 5,
      influencedProjectBudget: 2425000,
      lastInteractionAt: "2024-01-15T10:30:00Z",
      alignmentScore: 0.92, // Power user - high alignment
    },
    {
      designerId: "designer-002",
      totalViews: 890,
      totalSaves: 198,
      totalTags: 45,
      totalSpecIntentEvents: 12,
      activeProjectCount: 3,
      influencedProjectBudget: 960000,
      lastInteractionAt: "2024-01-14T14:20:00Z",
      alignmentScore: 0.78,
    },
    {
      designerId: "designer-003",
      totalViews: 1120,
      totalSaves: 267,
      totalTags: 67,
      totalSpecIntentEvents: 18,
      activeProjectCount: 4,
      influencedProjectBudget: 1640000,
      lastInteractionAt: "2024-01-15T09:15:00Z",
      alignmentScore: 0.85,
    },
    {
      designerId: "designer-004",
      totalViews: 720,
      totalSaves: 145,
      totalTags: 32,
      totalSpecIntentEvents: 8,
      activeProjectCount: 2,
      influencedProjectBudget: 500000,
      lastInteractionAt: "2024-01-12T16:45:00Z",
      alignmentScore: 0.65,
    },
    {
      designerId: "designer-005",
      totalViews: 450,
      totalSaves: 78,
      totalTags: 18,
      totalSpecIntentEvents: 4,
      activeProjectCount: 1,
      influencedProjectBudget: 180000,
      lastInteractionAt: "2023-11-20T11:30:00Z", // Cooled off - older interaction
      alignmentScore: 0.45,
    },
    {
      designerId: "designer-006",
      totalViews: 980,
      totalSaves: 234,
      totalTags: 58,
      totalSpecIntentEvents: 15,
      activeProjectCount: 3,
      influencedProjectBudget: 1230000,
      lastInteractionAt: "2024-01-13T13:20:00Z",
      alignmentScore: 0.82,
    },
    {
      designerId: "designer-007",
      totalViews: 1050,
      totalSaves: 289,
      totalTags: 72,
      totalSpecIntentEvents: 19,
      activeProjectCount: 4,
      influencedProjectBudget: 2080000,
      lastInteractionAt: "2024-01-15T08:00:00Z",
      alignmentScore: 0.88, // Power user
    },
    {
      designerId: "designer-008",
      totalViews: 380,
      totalSaves: 65,
      totalTags: 14,
      totalSpecIntentEvents: 3,
      activeProjectCount: 1,
      influencedProjectBudget: 250000,
      lastInteractionAt: "2024-01-09T15:10:00Z",
      alignmentScore: 0.52,
    },
    {
      designerId: "designer-009",
      totalViews: 820,
      totalSaves: 198,
      totalTags: 48,
      totalSpecIntentEvents: 13,
      activeProjectCount: 3,
      influencedProjectBudget: 890000,
      lastInteractionAt: "2024-01-14T10:00:00Z",
      alignmentScore: 0.72,
    },
    {
      designerId: "designer-010",
      totalViews: 1350,
      totalSaves: 398,
      totalTags: 102,
      totalSpecIntentEvents: 28,
      activeProjectCount: 6,
      influencedProjectBudget: 2850000,
      lastInteractionAt: "2024-01-15T11:00:00Z",
      alignmentScore: 0.94, // Power user - highest engagement
    },
  ],
  events: [
    {
      eventId: "event-001",
      name: "NYCxDesign",
      eventType: "Design Week",
      city: "New York",
      country: "United States",
      startDate: "2024-05-18T00:00:00Z",
      endDate: "2024-05-24T00:00:00Z",
      vendorBoothCost: 25000,
      vendorTravelCostEstimate: 5000,
      vendorSponsorshipCost: 10000,
    },
    {
      eventId: "event-002",
      name: "Miami Design Week",
      eventType: "Design Week",
      city: "Miami",
      country: "United States",
      startDate: "2024-12-01T00:00:00Z",
      endDate: "2024-12-07T00:00:00Z",
      vendorBoothCost: 18000,
      vendorTravelCostEstimate: 3500,
      vendorSponsorshipCost: 7500,
    },
    {
      eventId: "event-003",
      name: "ICFF",
      eventType: "Trade Show",
      city: "New York",
      country: "United States",
      startDate: "2024-05-19T00:00:00Z",
      endDate: "2024-05-22T00:00:00Z",
      vendorBoothCost: 22000,
      vendorTravelCostEstimate: 3000,
      vendorSponsorshipCost: 8500,
    },
  ],
  eventStats: [
    {
      eventId: "event-001",
      designerRsvps: 145,
      designerCheckins: 98,
      productViewsAtEvent: 2340,
      productSavesAtEvent: 567,
      productTagsAttributedToEvent: 189,
      influencedPipelineBudget: 4850000, // Strong event - high ROI
    },
    {
      eventId: "event-002",
      designerRsvps: 78,
      designerCheckins: 52,
      productViewsAtEvent: 1120,
      productSavesAtEvent: 234,
      productTagsAttributedToEvent: 67,
      influencedPipelineBudget: 890000, // Mediocre event
    },
    {
      eventId: "event-003",
      designerRsvps: 165,
      designerCheckins: 112,
      productViewsAtEvent: 1980,
      productSavesAtEvent: 445,
      productTagsAttributedToEvent: 142,
      influencedPipelineBudget: 2100000,
    },
  ],
  projects: [
    {
      projectId: "project-001",
      designerId: "designer-001",
      name: "Manhattan Penthouse Renovation",
      projectType: "Residential",
      estimatedBudgetTotal: 850000,
      status: "active",
      locationCity: "New York",
      locationCountry: "United States",
      startDate: "2024-01-01T00:00:00Z",
      targetCompletionDate: "2024-06-30T00:00:00Z",
    },
    {
      projectId: "project-002",
      designerId: "designer-003",
      name: "London Townhouse",
      projectType: "Residential",
      estimatedBudgetTotal: 620000,
      status: "active",
      locationCity: "London",
      locationCountry: "United Kingdom",
      startDate: "2024-02-01T00:00:00Z",
      targetCompletionDate: "2024-08-31T00:00:00Z",
    },
    {
      projectId: "project-003",
      designerId: "designer-007",
      name: "Paris Luxury Hotel",
      projectType: "Hospitality",
      estimatedBudgetTotal: 2400000,
      status: "active",
      locationCity: "Paris",
      locationCountry: "France",
      startDate: "2024-01-15T00:00:00Z",
      targetCompletionDate: "2024-12-31T00:00:00Z",
    },
    {
      projectId: "project-004",
      designerId: "designer-002",
      name: "LA Modern Home",
      projectType: "Residential",
      estimatedBudgetTotal: 480000,
      status: "concept",
      locationCity: "Los Angeles",
      locationCountry: "United States",
    },
    {
      projectId: "project-005",
      designerId: "designer-006",
      name: "Seattle Office Complex",
      projectType: "Commercial",
      estimatedBudgetTotal: 1200000,
      status: "active",
      locationCity: "Seattle",
      locationCountry: "United States",
      startDate: "2024-03-01T00:00:00Z",
      targetCompletionDate: "2024-09-30T00:00:00Z",
    },
    {
      projectId: "project-006",
      designerId: "designer-001",
      name: "Hamptons Estate",
      projectType: "Residential",
      estimatedBudgetTotal: 1950000,
      status: "active",
      locationCity: "East Hampton",
      locationCountry: "United States",
      startDate: "2024-02-15T00:00:00Z",
      targetCompletionDate: "2024-10-31T00:00:00Z",
    },
    {
      projectId: "project-007",
      designerId: "designer-010",
      name: "Tribeca Loft Renovation",
      projectType: "Residential",
      estimatedBudgetTotal: 1250000,
      status: "active",
      locationCity: "New York",
      locationCountry: "United States",
      startDate: "2024-01-20T00:00:00Z",
      targetCompletionDate: "2024-07-31T00:00:00Z",
    },
    {
      projectId: "project-008",
      designerId: "designer-004",
      name: "SF Urban Apartment",
      projectType: "Residential",
      estimatedBudgetTotal: 320000,
      status: "completed",
      locationCity: "San Francisco",
      locationCountry: "United States",
      startDate: "2023-06-01T00:00:00Z",
      targetCompletionDate: "2023-12-15T00:00:00Z",
    },
  ],
  projectInfluenceStats: [
    {
      projectId: "project-001",
      vendorInfluenceValue: 340000,
      taggedProductsCount: 8,
      specIntentCount: 5,
    },
    {
      projectId: "project-002",
      vendorInfluenceValue: 248000,
      taggedProductsCount: 6,
      specIntentCount: 3,
    },
    {
      projectId: "project-003",
      vendorInfluenceValue: 960000, // Large budget, strong influence
      taggedProductsCount: 12,
      specIntentCount: 8,
    },
    {
      projectId: "project-004",
      vendorInfluenceValue: 144000,
      taggedProductsCount: 4,
      specIntentCount: 2,
    },
    {
      projectId: "project-005",
      vendorInfluenceValue: 480000,
      taggedProductsCount: 7,
      specIntentCount: 4,
    },
    {
      projectId: "project-006",
      vendorInfluenceValue: 780000,
      taggedProductsCount: 10,
      specIntentCount: 6,
    },
    {
      projectId: "project-007",
      vendorInfluenceValue: 625000, // Strong influence on high-budget project
      taggedProductsCount: 9,
      specIntentCount: 7,
    },
    {
      projectId: "project-008",
      vendorInfluenceValue: 48000, // Low influence despite decent budget
      taggedProductsCount: 2,
      specIntentCount: 1,
    },
  ],
  questionLog: [
    {
      id: "q-001",
      vendorId: "vendor-ondulato-001",
      questionText: "Which designers should I build relationships with?",
      normalizedType: "designer_engagement",
      createdAt: "2024-01-10T10:00:00Z",
    },
    {
      id: "q-002",
      vendorId: "vendor-ondulato-001",
      questionText: "Which events actually produced real demand this year?",
      normalizedType: "event_impact",
      createdAt: "2024-01-12T14:30:00Z",
    },
    {
      id: "q-003",
      vendorId: "vendor-ondulato-001",
      questionText: "What is my current influence value across active projects?",
      normalizedType: "project_influence",
      createdAt: "2024-01-14T09:15:00Z",
    },
  ],
};

