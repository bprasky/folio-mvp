import type { MetadataRoute } from 'next';
import { absolutePublicUrl } from '@/lib/seo/public';
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV === 'preview') return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/auth/', '/onboarding/', '/settings/', '/designer/studio/', '/projects/new'] },
    sitemap: absolutePublicUrl('/sitemap.xml') };
}
