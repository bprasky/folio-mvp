// LEGACY ROUTE — scheduled for deprecation.
// Canonical product page is /products/[slug].
// TODO: Add redirect from this route to /products/[slug] once slug migration is complete.

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { isPubliclyDisplayable } from "@/lib/products/imageProvenance";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { DesignerTestimonials } from "@/components/product/DesignerTestimonials";

interface ProductPageProps {
  params: { productId: string };
}

export async function generateMetadata({ params }: { params: { productId: string } }): Promise<Metadata> {
  const product = await prisma.product.findUnique({
    where: { id: params.productId },
    select: {
      name: true,
      description: true,
      brand: true,
      imageUrl: true,
      imageSource: true,
      vendor: { select: { name: true } },
      vendorRecord: { select: { name: true } },
    },
  });

  if (!product) return { title: "Product Not Found | Folio" };

  const vendorName = product.vendor?.name || product.vendorRecord?.name || product.brand;
  const title = vendorName
    ? `${product.name} by ${vendorName} | Folio`
    : `${product.name} | Folio`;
  const description = product.description
    || `Discover ${product.name}${vendorName ? ` by ${vendorName}` : ""} — sourced and tagged by the design community on Folio.`;
  // Provenance gate (spec 17): never put a VENDOR_REFERENCE image in public OG meta.
  const ogImage = isPubliclyDisplayable(product.imageSource) ? product.imageUrl || null : null;

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

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await prisma.product.findUnique({
    where: { 
      OR: [
        { id: params.productId },
        { slug: params.productId }
      ]
    },
    include: {
      projectTags: {
        include: {
          project: {
            select: {
              id: true,
              title: true,
              description: true,
              images: {
                take: 1,
                select: {
                  url: true,
                },
              },
              designer: {
                select: {
                  id: true,
                  name: true,
                  profileImage: true,
                },
              },
              post: {
                select: {
                  slug: true,
                  status: true,
                },
              },
            },
          },
          projectImage: {
            select: {
              id: true,
              url: true,
              room: true,
            },
          },
        },
      },
      vendor: {
        select: {
          id: true,
          name: true,
          profileImage: true,
          companyName: true,
        },
      },
      vendorRecord: {
        select: {
          id: true,
          name: true,
          website: true,
          logoUrl: true,
        },
      },
    },
  });

  if (!product) {
    notFound();
  }

  // Provenance gate (spec 17): the public product page must not serve a
  // VENDOR_REFERENCE catalog image. Substitute the designer's in-situ crop.
  const publishableImages = isPubliclyDisplayable(product.imageSource);
  const insituCrop = product.projectTags?.find((t: any) => t.cropUrl)?.cropUrl ?? null;

  // Get all images for the product
  const productImages = !publishableImages
    ? (insituCrop ? [insituCrop] : [])
    : product.imageUrls && product.imageUrls.length > 0
      ? product.imageUrls
      : product.primaryImageUrl
        ? [product.primaryImageUrl]
        : product.imageUrl
          ? [product.imageUrl]
          : [];

  // Parse specs from JSON
  const specs = product.specsJson as any || {};

  // Get unique projects
  const uniqueProjects = Array.from(
    new Map(
      product.projectTags
        .filter(tag => tag.project)
        .map(tag => [tag.project!.id, tag.project!])
    ).values()
  );

  return (
    <div className="min-h-screen bg-surface-ground">
      {/* Header */}
      <div className="bg-surface-canvas border-b">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/magazine"
            className="text-[var(--accent)] hover:underline inline-flex items-center gap-2"
          >
            ← Back to Magazine
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Product Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-folio-text-primary mb-2">
                {product.name}
              </h1>
              <div className="flex items-center gap-4 text-folio-text-secondary">
                {product.brand && (
                  <span className="font-medium">{product.brand}</span>
                )}
                {product.category && (
                  <span>• {product.category}</span>
                )}
                {product.status === "draft" && (
                  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                    Draft
                  </span>
                )}
              </div>
            </div>
            {product.vendorRecord && (
              <div className="text-right">
                <p className="text-sm text-folio-text-secondary">Vendor</p>
                <p className="font-medium">{product.vendorRecord.name}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Image Gallery */}
            {productImages.length > 0 && (
              <div className="bg-surface-canvas rounded-lg shadow-sm overflow-hidden">
                <div className="relative aspect-video w-full">
                  <Image
                    src={productImages[0]}
                    alt={product.name}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                {productImages.length > 1 && (
                  <div className="grid grid-cols-4 gap-2 p-4">
                    {productImages.slice(1, 5).map((img, idx) => (
                      <div key={idx} className="relative aspect-square">
                        <Image
                          src={img}
                          alt={`${product.name} ${idx + 2}`}
                          fill
                          className="object-cover rounded"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="bg-surface-canvas rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-semibold mb-4">Description</h2>
                <p className="text-folio-text-primary leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* Specifications */}
            {(Object.keys(specs).length > 0 || product.price) && (
              <div className="bg-surface-canvas rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-semibold mb-4">Specifications</h2>
                <dl className="space-y-3">
                  {product.price && (
                    <div>
                      <dt className="text-sm font-medium text-folio-text-secondary">Price</dt>
                      <dd className="text-lg font-semibold">
                        {product.priceCurrency || "$"}
                        {product.price.toLocaleString()}
                        {product.priceRangeText && ` (${product.priceRangeText})`}
                      </dd>
                    </div>
                  )}
                  {specs.dimensions && (
                    <div>
                      <dt className="text-sm font-medium text-folio-text-secondary">Dimensions</dt>
                      <dd className="text-folio-text-primary">{specs.dimensions}</dd>
                    </div>
                  )}
                  {specs.materials && Array.isArray(specs.materials) && (
                    <div>
                      <dt className="text-sm font-medium text-folio-text-secondary">Materials</dt>
                      <dd className="text-folio-text-primary">{specs.materials.join(", ")}</dd>
                    </div>
                  )}
                  {specs.colors && Array.isArray(specs.colors) && (
                    <div>
                      <dt className="text-sm font-medium text-folio-text-secondary">Colors</dt>
                      <dd className="text-folio-text-primary">{specs.colors.join(", ")}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Used in Projects */}
            {uniqueProjects.length > 0 && (
              <div className="bg-surface-canvas rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-semibold mb-4">
                  Used in {uniqueProjects.length} {uniqueProjects.length === 1 ? "Project" : "Projects"}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {uniqueProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={project.post?.slug ? `/p/${project.post.slug}` : `/project/${project.id}`}
                      className="block border rounded-lg overflow-hidden hover:shadow-md transition"
                    >
                      {project.images && project.images.length > 0 && (
                        <div className="relative aspect-video w-full">
                          <Image
                            src={project.images[0].url}
                            alt={project.title || "Project"}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-1">
                          {project.title || "Untitled Project"}
                        </h3>
                        {project.designer && (
                          <p className="text-sm text-folio-text-secondary">
                            by {project.designer.name}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Designer Testimonials */}
            <DesignerTestimonials productId={product.id} />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Vendor Info */}
            {(product.vendorRecord || product.vendor) && (
              <div className="bg-surface-canvas rounded-lg shadow-sm p-6">
                <h3 className="font-semibold mb-4">Vendor Information</h3>
                {product.vendorRecord ? (
                  <div>
                    <p className="font-medium">{product.vendorRecord.name}</p>
                    {product.vendorRecord.website && (
                      <a
                        href={product.vendorRecord.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--accent)] hover:underline text-sm"
                      >
                        Visit Website
                      </a>
                    )}
                  </div>
                ) : product.vendor && (
                  <div>
                    <p className="font-medium">{product.vendor.name || product.vendor.companyName}</p>
                  </div>
                )}
              </div>
            )}

            {/* Source Info */}
            {product.sourceUrl && (
              <div className="bg-surface-canvas rounded-lg shadow-sm p-6">
                <h3 className="font-semibold mb-4">Source</h3>
                <p className="text-sm text-folio-text-secondary mb-2">
                  {product.sourceType || "Unknown source"}
                </p>
                <a
                  href={product.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline text-sm break-all"
                >
                  View Original
                </a>
              </div>
            )}

            {/* Stats */}
            <div className="bg-surface-canvas rounded-lg shadow-sm p-6">
              <h3 className="font-semibold mb-4">Statistics</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-folio-text-secondary">Projects</span>
                  <span className="font-medium">{uniqueProjects.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-folio-text-secondary">Tags</span>
                  <span className="font-medium">{product.projectTags.length}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}




