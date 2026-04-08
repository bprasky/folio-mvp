import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { notFound, redirect } from 'next/navigation';
import { ProductEditForm } from './ProductEditForm';

export default async function ProductEditPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const product = await prisma.product.findUnique({
    where: { id: params.slug },
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      brand: true,
      url: true,
      price: true,
      category: true,
      vendorId: true,
      vendor: {
        select: { name: true, companyName: true },
      },
    },
  });

  if (!product) notFound();

  return (
    <div className="min-h-screen bg-surface-ground">
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-xl font-semibold text-folio-text-primary mb-1">
          Complete Product Details
        </h1>
        <p className="text-sm text-folio-text-secondary mb-6">
          Help designers find and source this product by adding missing information.
        </p>
        <ProductEditForm product={product} />
      </div>
    </div>
  );
}
