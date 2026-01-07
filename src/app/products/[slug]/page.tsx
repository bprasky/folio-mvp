import { ProductPage } from "@/components/product/ProductPage";
import { CinematicProductPage } from "@/components/product/CinematicProductPage";
import { getProductById } from "@/lib/products/getProductById";
import { notFound } from "next/navigation";

export default async function ProductRoute({ params }: { params: { slug: string } }) {
  // Fetch real product from database
  const product = await getProductById(params.slug);
  
  if (!product) {
    notFound();
  }

  console.log('🎭 Product name in component props:', product.name);
  
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