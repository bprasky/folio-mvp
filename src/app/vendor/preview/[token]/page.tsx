import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ClaimProductForm from "@/components/vendor/ClaimProductForm";

interface VendorPreviewPageProps {
  params: { token: string };
}

export default async function VendorPreviewPage({ params }: VendorPreviewPageProps) {
  const previewToken = await prisma.vendorPreviewToken.findUnique({
    where: { token: params.token },
    include: {
      product: {
        include: {
          projectTags: {
            include: {
              project: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  images: {
                    take: 3,
                    select: {
                      id: true,
                      url: true,
                      room: true,
                    },
                  },
                  designer: {
                    select: {
                      id: true,
                      name: true,
                      profileImage: true,
                      companyName: true,
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
            },
          },
          vendorRecord: {
            select: {
              id: true,
              name: true,
              website: true,
            },
          },
        },
      },
      project: {
        select: {
          id: true,
          title: true,
          description: true,
          designer: {
            select: {
              id: true,
              name: true,
              profileImage: true,
              companyName: true,
            },
          },
        },
      },
      vendor: {
        select: {
          id: true,
          name: true,
          primaryEmail: true,
        },
      },
    },
  });

  if (!previewToken) {
    notFound();
  }

  if (previewToken.expiresAt < new Date()) {
    notFound();
  }

  const { product, project, vendor } = previewToken;

  // Get product images
  const productImages = product.imageUrls && product.imageUrls.length > 0
    ? product.imageUrls
    : product.primaryImageUrl
      ? [product.primaryImageUrl]
      : product.imageUrl
        ? [product.imageUrl]
        : [];

  // Get project images where product is tagged
  const taggedImages = product.projectTags
    .filter(tag => tag.projectImage)
    .map(tag => tag.projectImage!)
    .filter((img, idx, arr) => arr.findIndex(i => i.id === img.id) === idx); // unique

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Your Product Was Featured in a Folio Project
          </h1>
          <p className="text-xl text-gray-600">
            A verified Folio designer has featured your product in their project
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Product Info */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold mb-4">{product.name}</h2>
              {product.brand && (
                <p className="text-gray-600 mb-4">{product.brand}</p>
              )}
              {product.description && (
                <p className="text-gray-700 mb-6">{product.description}</p>
              )}

              {productImages.length > 0 && (
                <div className="relative aspect-video w-full rounded-lg overflow-hidden mb-6">
                  <Image
                    src={productImages[0]}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              {product.price && (
                <div className="mb-4">
                  <span className="text-sm text-gray-500">Price</span>
                  <p className="text-2xl font-bold">
                    {product.priceCurrency || "$"}
                    {product.price.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Project Info */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold mb-4">Featured In</h2>
              <h3 className="text-xl font-semibold mb-2">
                {project.title || "Untitled Project"}
              </h3>
              {project.description && (
                <p className="text-gray-600 mb-6">{project.description}</p>
              )}

              {project.designer && (
                <div className="flex items-center gap-3 mb-6">
                  {project.designer.profileImage && (
                    <div className="relative w-12 h-12 rounded-full overflow-hidden">
                      <Image
                        src={project.designer.profileImage}
                        alt={project.designer.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{project.designer.name}</p>
                    {project.designer.companyName && (
                      <p className="text-sm text-gray-600">{project.designer.companyName}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Project Images */}
              {taggedImages.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {taggedImages.slice(0, 4).map((img) => (
                    <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden">
                      <Image
                        src={img.url}
                        alt={img.room || "Project image"}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Call to Action Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold mb-4">Next Steps</h2>
            <p className="text-gray-600 mb-6">
              Claim this product to complete its specifications and connect with designers using your products.
            </p>

            <ClaimProductForm
              previewTokenId={previewToken.id}
              productId={product.id}
              vendorId={vendor?.id ?? null}
              productName={product.name}
            />

            <div className="mt-8 pt-8 border-t">
              <h3 className="font-semibold mb-4">What you can do:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Claim the product and complete its specifications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>See how it looks in the designer's project</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">✓</span>
                  <span>Explore how Folio can help you reach more designers</span>
                </li>
              </ul>
            </div>

            <div className="mt-6">
              <button
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
                disabled
              >
                Boost this post (Coming soon)
              </button>
            </div>

            <div className="mt-4">
              <Link
                href="/vendor/demo"
                className="text-blue-600 hover:underline"
              >
                Explore Folio vendor demo →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

