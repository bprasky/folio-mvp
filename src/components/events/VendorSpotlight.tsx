import SafeImage from "@/components/SafeImage";

type Vendor = {
  id: string;
  name?: string | null;
  companyName?: string | null;
  logoUrl?: string | null; // safe optional
};

export default function VendorSpotlight({ vendor }: { vendor?: Vendor | null }) {
  if (!vendor) return null;
  const name = vendor.companyName || vendor.name || "Vendor";
  return (
    <div className="w-full border border-folio-border rounded-xl bg-white shadow-sm p-4 flex items-center gap-3">
      <div className="relative h-12 w-12 rounded-full overflow-hidden bg-gray-100">
        {vendor.logoUrl ? (
          <SafeImage
            src={vendor.logoUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-sm text-gray-500">
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="font-medium truncate">{name}</div>
        <div className="text-sm text-gray-500 truncate">Hosted by {name}</div>
      </div>
    </div>
  );
} 