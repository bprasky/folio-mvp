// Demo data for Individual Hire page
// NOTE: This is dummy data for demonstration purposes only.
// Real scoring/matching logic will replace this in a future implementation.

export const demoIndividualHireData = {
  individual: {
    id: 'indiv_001',
    name: 'Jordan Rivera',
    location: 'Miami, FL',
    role: 'INDIVIDUAL',
    projectProfile: {
      rooms: [
        {
          id: 'room_living',
          name: 'Living Room',
          styleTags: ['modern', 'warm_neutrals', 'minimal'],
          savedItems: [
            { id: 'sofa_01', name: 'Low-Profile Linen Sofa', vendorId: 'vendor_arca', price: 4800, category: 'sofa' },
            { id: 'table_01', name: 'Travertine Coffee Table', vendorId: 'vendor_arca', price: 3200, category: 'coffee_table' },
            { id: 'lamp_01', name: 'Bronze Floor Lamp', vendorId: 'vendor_light', price: 950, category: 'lighting' }
          ]
        },
        {
          id: 'room_primary',
          name: 'Primary Bedroom',
          styleTags: ['modern', 'soft_textures', 'calm'],
          savedItems: [
            { id: 'bed_01', name: 'Upholstered Platform Bed', vendorId: 'vendor_bed', price: 3800, category: 'bed' },
            { id: 'rug_01', name: 'Hand-Knotted Wool Rug', vendorId: 'vendor_rug', price: 2600, category: 'rug' }
          ]
        }
      ],
      inferredSignals: {
        roomCount: 2,
        totalSavedItems: 5,
        averageItemPrice: 3070,
        projectTier: 'luxury',
        dominantStyleTags: ['modern', 'warm_neutrals', 'minimal', 'soft_textures'],
        topVendorsBySaves: [
          { vendorId: 'vendor_arca', saveCount: 2 },
          { vendorId: 'vendor_rug', saveCount: 1 }
        ]
      }
    }
  },
  designerMatches: [
    {
      designerId: 'designer_001',
      name: 'Studio Maris',
      location: 'Miami, FL',
      profileSlug: 'studio-maris',
      avatarUrl: '/images/designers/studio-maris.jpg',
      offerings: ['Full-service design', 'Remote design'],
      styleTags: ['modern', 'warm_neutrals', 'minimal'],
      projectRange: {
        minBudget: 50000,
        maxBudget: 250000,
        typicalScope: 'Whole-home and multi-room projects'
      },
      matchScores: {
        styleOverlap: 0.92,
        projectTierFit: 0.88,
        vendorOverlap: 0.75,
        locationFit: 1.0,
        overallMatch: 0.89
      },
      vendorOverlapDetail: [
        {
          vendorId: 'vendor_arca',
          vendorName: 'Grupo ARCA',
          sharedProductsApprox: 7
        },
        {
          vendorId: 'vendor_rug',
          vendorName: 'Rug House',
          sharedProductsApprox: 3
        }
      ],
      reasonChips: [
        'Frequently uses materials you\'ve saved',
        'Experienced with luxury projects your size',
        'Located in Miami • Offers in-person and remote'
      ],
      previewProjects: [
        {
          projectId: 'proj_001',
          name: 'Warm Minimalist Bayfront Condo',
          heroImageUrl: '/images/projects/bayfront-condo.jpg',
          overlappingTags: ['modern', 'warm_neutrals', 'minimal']
        },
        {
          projectId: 'proj_002',
          name: 'Soft Neutral Primary Suite',
          heroImageUrl: '/images/projects/primary-suite.jpg',
          overlappingTags: ['soft_textures', 'calm']
        }
      ],
      cta: {
        primary: {
          label: 'Request Intro',
          action: '/hire/designer_001/request-intro'
        },
        secondary: {
          label: 'View Portfolio',
          action: '/designers/studio-maris'
        }
      }
    },
    {
      designerId: 'designer_002',
      name: 'Atelier North',
      location: 'New York, NY',
      profileSlug: 'atelier-north',
      avatarUrl: '/images/designers/atelier-north.jpg',
      offerings: ['Remote design', 'Concept packages'],
      styleTags: ['modern', 'gallery_like', 'sculptural'],
      projectRange: {
        minBudget: 30000,
        maxBudget: 150000,
        typicalScope: 'Living room / primary suite packages'
      },
      matchScores: {
        styleOverlap: 0.74,
        projectTierFit: 0.8,
        vendorOverlap: 0.4,
        locationFit: 0.4,
        overallMatch: 0.68
      },
      vendorOverlapDetail: [],
      reasonChips: [
        'Strong style affinity with your saved rooms',
        'Great fit for a high-end living room + bedroom redesign',
        'Works remotely with clients nationwide'
      ],
      previewProjects: [
        {
          projectId: 'proj_010',
          name: 'Sculptural City Loft',
          heroImageUrl: '/images/projects/city-loft.jpg',
          overlappingTags: ['modern', 'gallery_like']
        }
      ],
      cta: {
        primary: {
          label: 'Book Remote Consult',
          action: '/hire/designer_002/book'
        },
        secondary: {
          label: 'View Portfolio',
          action: '/designers/atelier-north'
        }
      }
    },
    {
      designerId: 'designer_003',
      name: 'Casa Linea',
      location: 'Miami, FL',
      profileSlug: 'casa-linea',
      avatarUrl: '/images/designers/casa-linea.jpg',
      offerings: ['Room refresh', 'Styling', 'Remote design'],
      styleTags: ['cozy', 'transitional', 'family_friendly'],
      projectRange: {
        minBudget: 8000,
        maxBudget: 40000,
        typicalScope: 'Single-room refreshes'
      },
      matchScores: {
        styleOverlap: 0.35,
        projectTierFit: 0.3,
        vendorOverlap: 0.1,
        locationFit: 1.0,
        overallMatch: 0.38
      },
      vendorOverlapDetail: [],
      reasonChips: [
        'Best if you decide to do a smaller refresh instead of a full redesign',
        'Local Miami studio focused on single rooms and styling'
      ],
      previewProjects: [
        {
          projectId: 'proj_020',
          name: 'Family-Friendly Living Room Refresh',
          heroImageUrl: '/images/projects/family-living.jpg',
          overlappingTags: ['cozy']
        }
      ],
      cta: {
        primary: {
          label: 'Explore Smaller Scope Option',
          action: '/hire/designer_003/options'
        }
      }
    }
  ],
  uiCopy: {
    pageTitle: 'Designer Matches',
    pageSubtitle: 'Matched to your taste and project scale.',
    sections: {
      topMatchesTitle: 'Top Matches for Your Project',
      howWeMatchTitle: 'How these matches are calculated',
      howWeMatchBody:
        'We look at the rooms and products you\'ve saved, the materials you gravitate toward, and the typical size of your project. Then we match you with designers who share your style, work at your budget level, and frequently use similar vendors.'
    },
    filters: [
      {
        id: 'location',
        label: 'Location',
        options: ['Near Me', 'Remote Only', 'All']
      },
      {
        id: 'budget',
        label: 'Estimated Budget',
        options: ['Under $25K', '$25K–$75K', '$75K+']
      },
      {
        id: 'serviceLevel',
        label: 'Service Level',
        options: ['Full-service', 'Room refresh', 'Remote design']
      }
    ]
  }
};




