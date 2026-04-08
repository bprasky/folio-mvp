import type { Metadata } from "next";
import { ProductPage } from "@/components/product/ProductPage";
import { CinematicProductPage } from "@/components/product/CinematicProductPage";
import { IncompleteProductPage } from "@/components/product/IncompleteProductPage";
import { getProductById } from "@/lib/products/getProductById";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await getProductById(params.slug);
  if (!product) return { title: "Product Not Found | Folio" };

  const vendorName = product.brand || null;
  const title = vendorName
    ? `${product.name} by ${vendorName} | Folio`
    : `${product.name} | Folio`;
  const description = product.description
    || `Discover ${product.name}${vendorName ? ` by ${vendorName}` : ""} — sourced and tagged by the design community on Folio.`;
  const ogImage = product.assets[0]?.src || null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(ogImage && { images: [{ url: ogImage }] }),
    },
  };
}

export default async function ProductRoute({ params }: { params: { slug: string } }) {
  const product = await getProductById(params.slug);

  if (!product) {
    notFound();
  }

  // Incomplete products get a dedicated page instead of broken UI
  if (product._completeness !== 'full') {
    return (
      <IncompleteProductPage
        productId={product.id}
        productName={product.name}
        vendorName={product._vendorName}
        vendorEmail={product._vendorEmail}
        brand={product.brand}
        productUrl={product._productUrl}
        hasImage={product.assets.length > 0}
      />
    );
  }

  // Feature flag for cinematic layout
  const useCinematicLayout = process.env.NEXT_PUBLIC_FEATURE_CINEMATIC_PRODUCT === "1";

  if (useCinematicLayout) {
    return (
      <div className="cinematic-page">
        <CinematicProductPage product={product} />
      </div>
    );
  }

  return <ProductPage product={product} />;
}
