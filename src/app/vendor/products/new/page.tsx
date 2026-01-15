import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ProductWizard } from '@/components/vendor/add-product/Wizard';

export default async function NewProductPage() {
  // Feature flag check
  const featureEnabled = process.env.NEXT_PUBLIC_FEATURE_VENDOR_ADD_PRODUCT === '1';
  
  if (!featureEnabled) {
    redirect('/vendor/dashboard');
  }

  // Session and role check
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Check if user is vendor
  const userRole = session.user.role?.toLowerCase();
  if (userRole !== 'vendor') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <ProductWizard vendorId={session.user.id || ''} />
    </div>
  );
}

