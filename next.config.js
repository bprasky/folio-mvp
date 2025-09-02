/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let supaHost;
try {
  supaHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined; // e.g. xxxx.supabase.co
} catch {}

const nextConfig = {
  reactStrictMode: true,
  // Configure middleware location
  experimental: {
    turbo: {
      watchOptions: {
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**']
      }
    }
  },
  // Disable automatic static optimization to prevent file overwrites
  staticPageGenerationTimeout: 60,
  // Route rewrites for designer project aliases
  async rewrites() {
    return [
      {
        source: '/designer/:handle/projects/:projectId',
        destination: '/project/:projectId',
      },
    ];
  },
  // Redirects for route consolidation
  async redirects() {
    return [
      { source: '/designer', destination: '/projects', permanent: true },
    ];
  },
  // Configure webpack to not watch certain files
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Disable watching for backup files and prevent auto-restoration
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/*.backup',
          '**/page.tsx.backup',
          '**/page_backup_.tsx'
        ]
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      // Allow your Supabase Storage images
      ...(supaHost
        ? [
            {
              protocol: "https",
              hostname: supaHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),

      // Common sources we've seen in events/festivals:
      { protocol: "https", hostname: "s3.amazonaws.com", pathname: "/**" },
      { protocol: "https", hostname: "*.s3.amazonaws.com", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "www.thisiscolossal.com", pathname: "/**" },
      // Note: Removed via.placeholder.com dependency - now using local fallbacks

      // Existing patterns
      { protocol: 'https', hostname: 'ik.imgkit.net' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'images.ntmllc.com' },
      { protocol: 'https', hostname: 'landscapearchitecturebuilt.com' },
      { protocol: 'https', hostname: 'static.prod.r53.tablethotels.com' },
      { protocol: 'http', hostname: 'images.ntmllc.com' }, // legacy http

      // Safety net for editorial/press domains:
      { protocol: "https", hostname: "**", pathname: "/**" },
    ],
    formats: ['image/avif', 'image/webp'],
  },
};

module.exports = nextConfig; 