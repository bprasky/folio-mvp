/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let supaHost;
try {
  supaHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined; // e.g. xxxx.supabase.co
} catch {}

const nextConfig = {
  reactStrictMode: true,
  // Skip type checking during build (types need cleanup)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Skip ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
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
      // Rewrite /@username to /monograph/username for designer monograph pages
      {
        source: '/@:username',
        destination: '/monograph/:username',
      },
    ];
  },
  // Redirects for route consolidation
  async redirects() {
    return [
      { source: '/', destination: '/magazine', permanent: false },
      { source: '/designer', destination: '/projects', permanent: true },
      { source: '/designer/projects', destination: '/projects', permanent: true },
      { source: '/for-designers/directory', destination: '/for-designers/sourcebook', permanent: true },
      { source: '/for-designers/bio', destination: '/for-designers/discovery', permanent: true },
      { source: '/for-designers/attribution', destination: '/for-designers/discovery', permanent: true },
      { source: '/for-designers/client-matching', destination: '/for-designers/discovery', permanent: true },
    ];
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com https://api.stripe.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
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

    // Handle Three.js and react-three-fiber for client-side only
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Externalize native modules for server-side (API routes)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@napi-rs/canvas': 'commonjs @napi-rs/canvas',
        'canvas': 'commonjs canvas',
      });
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
      { protocol: 'https', hostname: 'www.artexplore.net' }, // Art Explore CDN
      { protocol: 'http', hostname: 'www.artexplore.net' }, // Art Explore CDN (http)
      { protocol: 'https', hostname: 'pinlighting.com', pathname: '/**' }, // Pin Lighting CDN
      { protocol: 'http', hostname: 'pinlighting.com', pathname: '/**' }, // Pin Lighting CDN (http)

      // Additional editorial/press domains can be added here as needed
    ],
    formats: ['image/avif', 'image/webp'],
  },
};

module.exports = nextConfig; 