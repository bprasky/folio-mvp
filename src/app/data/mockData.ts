export interface Card {
  id: number;
  feedType: string;
  subType: string;
  size: string;
  type: string;
  title?: string;
  name?: string;
  author?: string;
  brand?: string;
  specialty?: string;
  image: string;
  price?: string;
  cta?: string;
}

export const allCards: Card[] = [
  // Editorials
  { 
    id: 1, 
    feedType: "forYou", 
    subType: "project", 
    size: "2x1", 
    type: "editorial", 
    title: "Modern Loft Feature", 
    author: "Ava Martinez", 
    image: "https://source.unsplash.com/random/1200x800?interior,loft,modern" 
  },
  { 
    id: 2, 
    feedType: "rising", 
    subType: "project", 
    size: "2x1", 
    type: "editorial", 
    title: "Minimalism Reimagined", 
    author: "Lars Jensen", 
    image: "https://source.unsplash.com/random/1200x800?interior,minimalist,design" 
  },
  { 
    id: 3, 
    feedType: "forYou", 
    subType: "project", 
    size: "2x1", 
    type: "editorial", 
    title: "Gallery Wall Moment", 
    author: "Harper & Moss", 
    image: "https://source.unsplash.com/random/1200x800?interior,gallerywall,art" 
  },
  // Moodboards
  { 
    id: 4, 
    feedType: "forYou", 
    subType: "project", 
    size: "1x1", 
    type: "moodboard", 
    title: "Urban Jungle Inspiration", 
    author: "Leaf & Co.", 
    image: "https://source.unsplash.com/random/800x600?interior,urbanjungle,plants" 
  },
  { 
    id: 5, 
    feedType: "local", 
    subType: "project", 
    size: "1x1", 
    type: "moodboard", 
    title: "Earthy Tones Moodboard", 
    author: "Studio Verde", 
    image: "https://source.unsplash.com/random/800x600?interior,earthy,tones" 
  },
  { 
    id: 6, 
    feedType: "local", 
    subType: "project", 
    size: "1x1", 
    type: "moodboard", 
    title: "Natural Kitchen", 
    author: "Terra Studio", 
    image: "https://source.unsplash.com/random/800x600?interior,kitchen,natural" 
  },
  // Products
  { 
    id: 7, 
    feedType: "forYou", 
    subType: "product", 
    size: "1x1", 
    type: "product", 
    name: "Modular Sofa System", 
    brand: "Muuto", 
    price: "$2,499+",
    image: "https://source.unsplash.com/random/800x600?product,sofa,modular", 
    cta: "Shop Now" 
  },
  { 
    id: 8, 
    feedType: "local", 
    subType: "product", 
    size: "1x1", 
    type: "product", 
    name: "Pendant Light", 
    brand: "Tom Dixon", 
    price: "$1,250",
    image: "https://source.unsplash.com/random/800x600?product,lighting,pendant", 
    cta: "Shop Now" 
  },
  { 
    id: 9, 
    feedType: "rising", 
    subType: "product", 
    size: "1x1", 
    type: "product", 
    name: "Designer Chair", 
    brand: "Vitra", 
    price: "$899",
    image: "https://source.unsplash.com/random/800x600?product,chair,designer", 
    cta: "Shop Now" 
  },
  // New West Elm Products
  { 
    id: 12, 
    feedType: "forYou", 
    subType: "product", 
    size: "1x1", 
    type: "product", 
    name: "Harmony Sofa", 
    brand: "West Elm", 
    price: "$1,329.30", 
    image: "https://source.unsplash.com/random/800x600?product,sofa,harmony", 
    cta: "Shop Now" 
  },
  { 
    id: 13, 
    feedType: "forYou", 
    subType: "product", 
    size: "1x1", 
    type: "product", 
    name: "Flower Table Lamp", 
    brand: "West Elm", 
    price: "$159.20", 
    image: "https://source.unsplash.com/random/800x600?product,lamp,flower", 
    cta: "Shop Now" 
  },
  { 
    id: 14, 
    feedType: "forYou", 
    subType: "product", 
    size: "1x1", 
    type: "product", 
    name: "Belle Nightstand", 
    brand: "West Elm", 
    price: "$199", 
    image: "https://source.unsplash.com/random/800x600?product,nightstand,belle", 
    cta: "Shop Now" 
  },
  { 
    id: 15, 
    feedType: "forYou", 
    subType: "product", 
    size: "1x1", 
    type: "product", 
    name: "Lumini Easy Care Rug, 5' x 8'", 
    brand: "West Elm", 
    price: "$399", 
    image: "https://source.unsplash.com/random/800x600?product,rug,lumini", 
    cta: "Shop Now" 
  },
  { 
    id: 16, 
    feedType: "forYou", 
    subType: "product", 
    size: "1x1", 
    type: "product", 
    name: "Penn Chair", 
    brand: "West Elm", 
    price: "$399", 
    image: "https://source.unsplash.com/random/800x600?product,chair,penn", 
    cta: "Shop Now" 
  },
  { 
    id: 17, 
    feedType: "forYou", 
    subType: "product", 
    size: "1x1", 
    type: "product", 
    name: "Silky Tencel Modal Sheet Set", 
    brand: "West Elm", 
    price: "$119.20", 
    image: "https://source.unsplash.com/random/800x600?product,sheets,tencel", 
    cta: "Shop Now" 
  },
  { 
    id: 18, 
    feedType: "forYou", 
    subType: "product", 
    size: "1x1", 
    type: "product", 
    name: "Worn Velvet Blackout Curtains, 48\" x 84\" (Set of 2)", 
    brand: "West Elm", 
    price: "$298", 
    image: "https://source.unsplash.com/random/800x600?product,curtains,velvet", 
    cta: "Shop Now" 
  },
  { 
    id: 19, 
    feedType: "forYou", 
    subType: "product", 
    size: "1x1", 
    type: "product", 
    name: "Mella Sofa", 
    brand: "West Elm", 
    price: "$799", 
    image: "https://source.unsplash.com/random/800x600?product,sofa,mella", 
    cta: "Shop Now" 
  },
  // Designers
  { 
    id: 10, 
    feedType: "forYou", 
    subType: "project", 
    size: "1x1", 
    type: "designer", 
    name: "Kelly Wearstler", 
    specialty: "Luxury Interiors", 
    image: "https://randomuser.me/api/portraits/women/44.jpg" 
  },
  { 
    id: 11, 
    feedType: "local", 
    subType: "project", 
    size: "1x1", 
    type: "designer", 
    name: "Norm Architects", 
    specialty: "Minimalist Spaces", 
    image: "https://randomuser.me/api/portraits/men/32.jpg" 
  },
  { 
    id: 20, 
    feedType: "forYou", 
    subType: "designer", 
    size: "1x1", 
    type: "designer", 
    name: "Design By Emily", 
    specialty: "E-design, Budget Friendly", 
    image: "https://source.unsplash.com/random/800x600?designer,profile,emily", 
    cta: "View Profile" 
  },
  { 
    id: 21, 
    feedType: "forYou", 
    subType: "designer", 
    size: "1x1", 
    type: "designer", 
    name: "Studio D.Lux", 
    specialty: "Sustainable Designs", 
    image: "https://source.unsplash.com/random/800x600?designer,profile,sustainability", 
    cta: "View Profile" 
  },
  { 
    id: 22, 
    feedType: "forYou", 
    subType: "designer", 
    size: "1x1", 
    type: "designer", 
    name: "Architekt", 
    specialty: "Modern Homes", 
    image: "https://source.unsplash.com/random/800x600?designer,profile,architect", 
    cta: "View Profile" 
  },
  { 
    id: 23, 
    feedType: "rising", 
    subType: "designer", 
    size: "1x1", 
    type: "designer", 
    name: "Urban Oasis Design", 
    specialty: "Biophilic, Small Spaces", 
    image: "https://source.unsplash.com/random/800x600?designer,profile,urbanoasis", 
    cta: "View Profile" 
  },
  { 
    id: 24, 
    feedType: "local", 
    subType: "designer", 
    size: "1x1", 
    type: "designer", 
    name: "Coastal Living Interiors", 
    specialty: "Coastal, Relaxed", 
    image: "https://source.unsplash.com/random/800x600?designer,profile,coastal", 
    cta: "View Profile" 
  },
  { 
    id: 25, 
    feedType: "forYou", 
    subType: "designer", 
    size: "1x1", 
    type: "designer", 
    name: "Vintage Revivals", 
    specialty: "Mid-Century Modern, Eclectic", 
    image: "https://source.unsplash.com/random/800x600?designer,profile,vintage", 
    cta: "View Profile" 
  }
]; 