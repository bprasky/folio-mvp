import type { Metadata } from "next";
import { ProductPage } from "@/components/product/ProductPage";
import { ImmersiveProductPage } from "@/components/product/ImmersiveProductPage";
import { getProductById } from "@/lib/products/getProductById";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
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

  // Server-side session + role check for vendor intelligence gating
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role as string | undefined;
  const isVendorOwner = userRole === 'VENDOR' && product._vendorId === session?.user?.id;
  const isAdmin = userRole === 'ADMIN';
  const showVendorInsights = isVendorOwner || isAdmin;

  // Feature flag for cinematic layout
  const useCinematicLayout = process.env.NEXT_PUBLIC_FEATURE_CINEMATIC_PRODUCT === "1";

  if (useCinematicLayout) {
    return (
      <div className="cinematic-page">
        <ImmersiveProductPage
          product={product}
          showVendorInsights={showVendorInsights}
          isVendorOwner={isVendorOwner}
        />
      </div>
    );
  }

  return <ProductPage product={product} />;
}
