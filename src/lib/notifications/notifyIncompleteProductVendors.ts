import { prisma } from '@/lib/prisma';

/**
 * Fire-and-forget: After a project is published, check for incomplete products
 * that have vendor info. Notify those vendors to complete the specs.
 *
 * "Your designer posted with incomplete specs — want to complete them?"
 */
export function notifyIncompleteProductVendors(projectId: string): void {
  notifyIncompleteProductVendorsSafe(projectId).catch(() => {});
}

async function notifyIncompleteProductVendorsSafe(projectId: string): Promise<void> {
  try {
    // Get all product tags from this project's images, with product + vendor data
    const tags = await prisma.productTag.findMany({
      where: {
        image: { projectId },
      },
      select: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            url: true,
            brand: true,
            vendorId: true,
            vendor: {
              select: {
                id: true,
                name: true,
                email: true,
                companyName: true,
              },
            },
          },
        },
      },
    });

    // Get project + designer info for the notification
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        title: true,
        designer: {
          select: { name: true, studio: true },
        },
      },
    });

    const designerName = project?.designer?.studio || project?.designer?.name || 'A designer';

    // Find incomplete products that have vendor contact info
    const vendorNotifications = new Map<string, {
      vendorUserId: string;
      vendorEmail: string;
      vendorName: string;
      products: Array<{ id: string; name: string; missing: string[] }>;
    }>();

    for (const tag of tags) {
      const product = tag.product;
      if (!product) continue;

      // Check if product is incomplete
      const hasImage = !!product.imageUrl;
      const hasUrl = !!product.url;
      const hasBrand = !!(product.brand || product.vendorId);
      const isComplete = hasImage && hasUrl && hasBrand;
      if (isComplete) continue;

      // Must have vendor info to notify
      if (!product.vendor?.email) continue;

      const vendorKey = product.vendor.id;
      const missing: string[] = [];
      if (!hasImage) missing.push('product image');
      if (!hasUrl) missing.push('product URL');
      if (!hasBrand) missing.push('brand info');

      if (!vendorNotifications.has(vendorKey)) {
        vendorNotifications.set(vendorKey, {
          vendorUserId: product.vendor.id,
          vendorEmail: product.vendor.email,
          vendorName: product.vendor.companyName || product.vendor.name,
          products: [],
        });
      }

      const entry = vendorNotifications.get(vendorKey)!;
      if (!entry.products.find(p => p.id === product.id)) {
        entry.products.push({ id: product.id, name: product.name, missing });
      }
    }

    if (vendorNotifications.size === 0) return;

    // Create in-app notifications for each vendor
    const entries = Array.from(vendorNotifications.values());
    for (const data of entries) {
      // Rate limit: check if we already notified this vendor about incomplete specs in last 7 days
      const recentNotification = await prisma.notification.findFirst({
        where: {
          userId: data.vendorUserId,
          type: 'INCOMPLETE_SPECS_ON_PUBLISH',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });

      if (recentNotification) continue;

      const productNames = data.products.map(p => p.name).slice(0, 3);
      const productList = productNames.join(', ');
      const moreCount = data.products.length - 3;

      await prisma.notification.create({
        data: {
          userId: data.vendorUserId,
          type: 'INCOMPLETE_SPECS_ON_PUBLISH',
          title: `${designerName} featured your products — specs needed`,
          body: `${productList}${moreCount > 0 ? ` and ${moreCount} more` : ''} ${data.products.length === 1 ? 'is' : 'are'} missing details. Complete ${data.products.length === 1 ? 'its' : 'their'} specs to get properly credited.`,
          actionUrl: `/vendor/products`,
          metadata: {
            projectId,
            projectTitle: project?.title,
            designerName,
            products: data.products,
            vendorEmail: data.vendorEmail,
          },
        },
      });

      // Also create a signal for tracking/admin visibility
      await prisma.vendorInviteSignal.create({
        data: {
          vendorName: data.vendorName,
          signalType: 'INCOMPLETE_SPECS_ON_PUBLISH',
          projectId,
          designerId: project?.designer?.name ? undefined : undefined,
          metadata: {
            products: data.products,
            vendorEmail: data.vendorEmail,
          },
        },
      });

      console.log('[notifyIncompleteProductVendors] Notified vendor', {
        vendorName: data.vendorName,
        productCount: data.products.length,
        projectId,
      });
    }
  } catch (error: any) {
    console.error('[notifyIncompleteProductVendors] Failed (non-fatal)', {
      projectId,
      error: error.message,
    });
  }
}
