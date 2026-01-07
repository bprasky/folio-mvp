import Image from 'next/image';

interface Product {
  id: string;
  name: string;
  vendor: string;
  imageUrl: string | null;
  price: number | null;
  tagCount: number;
  projectCount: number;
}

interface KnownForCarouselProps {
  products: Product[];
}

export default function KnownForCarousel({ products }: KnownForCarouselProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-8">
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-stone-900 font-light mb-4">
          Known For
        </h2>
        <p className="text-stone-600 text-sm md:text-base font-light">
          Signature products and materials across published work
        </p>
      </div>

      {/* Horizontal Scroll Container */}
      <div className="overflow-x-auto pb-4 -mx-6 px-6">
        <div className="flex gap-4 md:gap-6 min-w-max">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-shrink-0 w-64 md:w-80 bg-white rounded-lg border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              {/* Product Image */}
              <div className="relative w-full h-48 md:h-56 bg-stone-100">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 256px, 320px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                    <span className="text-sm">No image</span>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4 md:p-6">
                <h3 className="font-serif text-lg md:text-xl text-stone-900 font-light mb-1">
                  {product.name}
                </h3>
                <p className="text-stone-600 text-sm font-light mb-4">
                  {product.vendor}
                </p>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-stone-500 border-t border-stone-100 pt-4">
                  <div className="flex items-center gap-2">
                    <span>💾 {product.tagCount} saves</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>📋 {product.projectCount} projects</span>
                  </div>
                </div>

                {product.price && (
                  <div className="mt-3 text-sm text-stone-700 font-light">
                    ${product.price.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
