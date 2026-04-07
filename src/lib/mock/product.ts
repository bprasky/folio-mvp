// DEPRECATED — mock data file. MOCK_PRODUCT is no longer used in production.
// Retained for type definitions and local dev seeding only.

export type ProductAsset = { type: "image"|"video"; src: string; alt?: string };
export type FileLink = { label: string; href: string };
export type TaggedImage = { id: string; src: string; likes: number; room: string; by: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price?: number; // optional (trade)
  description: string;
  materials: string[];
  finish: string;
  dimensions: { w: number; d: number; h: number; units: "in"|"cm" };
  weight?: { value: number; units: "lb"|"kg" };
  sku: string;
  leadTime?: string;
  assets: ProductAsset[];
  files: { specSheets: FileLink[]; _3d: FileLink[]; others?: FileLink[] };
  inspiration: TaggedImage[]; // affiliate-tagged, most liked
  insights: {
    saves: number;
    tags: number;
    saveToTagPct: number;
    topRooms: { label: string; pct: number }[];
    topMarkets: { city: string; pct: number }[];
  };
  mesh3dUrl?: string;
  related: Array<Pick<Product,"id"|"slug"|"name"> & { thumb: string }>;
};

export const MOCK_PRODUCT: Product = {
  id: "prod_terra_travertine",
  slug: "terra-travertine-side-table",
  name: "Terra Travertine Side Table",
  brand: "Folio Studio",
  description: "A monolithic side table in honed travertine with soft radius edge.",
  materials: ["Travertine"],
  finish: "Honed Natural",
  dimensions: { w: 20, d: 20, h: 18, units: "in" },
  sku: "FS-TERRA-20",
  leadTime: "6–8 weeks",
  assets: [
    { type:"image", src:"/demo/terra1.jpg", alt:"hero" },
    { type:"image", src:"/demo/terra2.jpg" },
    { type:"video", src:"/demo/terra.mp4" },
  ],
  files: {
    specSheets: [{ label:"Spec Sheet (PDF)", href:"#spec-pdf" }],
    _3d: [{ label:"3D Model (.obj)", href:"#obj" }, { label:"Revit (.rfa)", href:"#rfa" }],
    others: [{ label:"Care & Maintenance", href:"#care" }],
  },
  inspiration: [
    { id:"i1", src:"/demo/inspo1.jpg", likes: 184, room:"Living", by:"Studio Linares" },
    { id:"i2", src:"/demo/inspo2.jpg", likes: 152, room:"Bedroom", by:"Atelier North" },
    { id:"i3", src:"/demo/inspo3.jpg", likes: 121, room:"Living", by:"Field & Co." },
    { id:"i4", src:"/demo/inspo4.jpg", likes: 95,  room:"Outdoor", by:"Arbor Design" },
  ],
  insights: {
    saves: 842, tags: 196, saveToTagPct: 23,
    topRooms: [{label:"Living", pct:42},{label:"Bedroom", pct:26},{label:"Outdoor", pct:12}],
    topMarkets: [{city:"New York", pct:38},{city:"Miami", pct:18},{city:"Austin", pct:12}],
  },
  related: [
    { id:"p2", slug:"terra-console", name:"Terra Console", thumb:"/demo/rel1.jpg" },
    { id:"p3", slug:"calacatta-coffee", name:"Calacatta Coffee Table", thumb:"/demo/rel2.jpg" },
    { id:"p4", slug:"oak-ribbon-chair", name:"Oak Ribbon Chair", thumb:"/demo/rel3.jpg" },
  ]
};





