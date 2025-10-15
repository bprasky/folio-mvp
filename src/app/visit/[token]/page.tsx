import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

interface VisitTokenPageProps {
  params: { token: string };
}

export default async function VisitPage({ params }: { params: { token: string }}) {
  const session = await getServerSession().catch(() => null);
  const userEmail = session?.user?.email?.toLowerCase() || null;

  const visit = await prisma.vendorVisit.findUnique({
    where: { token: params.token },
    select: { token: true, designerEmail: true, projectId: true },
  });

  if (!visit) {
    return <div className="p-6">This handoff link is invalid or expired.</div>;
  }

  const intended = visit.designerEmail?.toLowerCase?.() || null;
  if (!userEmail) {
    return (
      <div className="p-6">
        <div className="mb-2">This handoff is for <b>{intended}</b>. Please sign in to continue.</div>
        <Link className="underline" href="/auth/signin">Sign in</Link>
      </div>
    );
  }
  if (userEmail !== intended) {
    return (
      <div className="p-6">
        <div className="mb-2">This handoff is for <b>{intended}</b>, but you're signed in as <b>{userEmail}</b>.</div>
        <Link className="underline" href="/auth/logout">Switch account</Link>
      </div>
    );
  }

  // ✅ Render your existing claim UI here (new or existing project)
  // Keep your previous component / actions if you already have them,
  // or show a minimal claim form.

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-4">Claim Handoff</h1>
      {/* mount your existing claim UI / actions */}
      {/* For example: <ClaimDestination token={visit.token} sourceProjectId={visit.projectId} /> */}
    </div>
  );
}

function ErrorBlock({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <section className="max-w-lg mx-auto p-8 text-center space-y-3">
      <h1 className="text-2xl font-serif">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
    </section>
  );
}

function VisitLanding({ tokenId, token }: { tokenId: string; token: any }) {
  const items = token.handoffPackage?.itemsJson as any[] || [];
  
  return (
    <section className="max-w-4xl mx-auto p-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-serif">Vendor Handoff</h1>
          <p className="text-gray-600">Review the products and choose where to add them.</p>
        </div>

        {token.note && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-1">Note from vendor</h3>
            <p className="text-blue-800 text-sm">{token.note}</p>
          </div>
        )}

        {/* Product Gallery */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="space-y-2">
                  <h3 className="font-medium">{item.sku || item.productName || 'Product'}</h3>
                  {item.finish && <p className="text-sm text-gray-600">Finish: {item.finish}</p>}
                  {item.quantity && <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>}
                  {item.note && <p className="text-sm text-gray-600">{item.note}</p>}
                  {item.imageUrl && (
                    <img 
                      src={item.imageUrl} 
                      alt={item.sku || 'Product'} 
                      className="w-full h-32 object-cover rounded"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quote Preview */}
        {token.handoffPackage?.quoteAttachmentId && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-medium text-green-900 mb-1">Quote attached</h3>
            <p className="text-green-800 text-sm">A quote has been included with this handoff.</p>
          </div>
        )}

        {/* Destination Selection */}
        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-4">Choose destination</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DestinationOption 
              title="New Project" 
              description="Create a new project for these items"
              choice="new"
              tokenId={tokenId}
            />
            <DestinationOption 
              title="Existing Project" 
              description="Add to an existing project"
              choice="existing"
              tokenId={tokenId}
            />
            <DestinationOption 
              title="Spec Sheet" 
              description="Create a specification sheet"
              choice="specsheet"
              tokenId={tokenId}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function DestinationOption({ 
  title, 
  description, 
  choice, 
  tokenId 
}: { 
  title: string; 
  description: string; 
  choice: string; 
  tokenId: string;
}) {
  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      <button 
        className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
        onClick={async () => {
          // Handle destination selection
          const response = await fetch(`/api/visit-tokens/${tokenId}/choose-destination`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ choice }),
          });
          
          if (response.ok) {
            const { projectId } = await response.json();
            window.location.href = `/designer/projects/${projectId}`;
          }
        }}
      >
        Choose {title}
      </button>
    </div>
  );
}