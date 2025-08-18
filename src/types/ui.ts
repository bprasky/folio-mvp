export type UIProduct = {
  id: string;
  name: string;
  imageUrl?: string | null;
  vendorName?: string | null;
  vendorLogoUrl?: string | null;
  url?: string | null;            // optional external URL
  saves?: number;                 // optional analytics hint
  views?: number;                 // optional analytics hint
}; 