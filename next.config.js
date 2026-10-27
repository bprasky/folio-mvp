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
    },
    // pdfjs-dist / pdf-to-png-converter load @napi-rs/canvas (a native module)
    // at runtime to provide DOMMatrix/ImageData/Path2D and page rendering.
    // Externalize it so webpack doesn't bundle the .node binary, and force its
    // platform binary into the PDF routes' serverless bundles — nft can't
    // follow @napi-rs/canvas's dynamic platform-binary require, so on Vercel it
    // was missing, giving "DOMMatrix is not defined".
    serverComponentsExternalPackages: ['@napi-rs/canvas'],
    outputFileTracingIncludes: {
      '/api/projects/[id]/extract-pdf': [
        // The main @napi-rs/canvas package (its index.js is what
        // `require('@napi-rs/canvas')` loads to polyfill DOMMatrix/ImageData/
        // Path2D). nft doesn't trace it into the Lambda on its own, so without
        // this the route dies at runtime with "Cannot find module
        // '@napi-rs/canvas'" → "DOMMatrix is not defined". The platform-binary
        // packages below are its native .node payload for linux x64.
        './node_modules/@napi-rs/canvas/**',
        './node_modules/@napi-rs/canvas-linux-x64-gnu/**',
        './node_modules/@napi-rs/canvas-linux-x64-musl/**',
        // pdfjs loads its fake worker from this file at runtime (workerSrc in
        // src/lib/pdf/extractText.ts). nft can't follow the dynamic resolve, so
        // force it into the bundle or extraction 500s with a fake-worker error.
        './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      ],
      '/api/projects/[id]/import-spec': [
        './node_modules/@napi-rs/canvas/**',
        './node_modules/@napi-rs/canvas-linux-x64-gnu/**',
        './node_modules/@napi-rs/canvas-linux-x64-musl/**',
        './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      ],
      '/api/import/[sessionId]/analyze': [
        './node_modules/@napi-rs/canvas/**',
        './node_modules/@napi-rs/canvas-linux-x64-gnu/**',
        './node_modules/@napi-rs/canvas-linux-x64-musl/**',
        './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      ],
    },
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
  // Redirects for route consolidation.
  //
  // Note: `/` is NOT redirected — it renders the editorial elevation feed
  // (see src/app/page.tsx). `/magazine` redirects to `/` via app-router
  // logic in src/app/magazine/page.tsx, not here, so deeplinks resolve at
  // the same caching layer as the homepage itself.
  async redirects() {
    return [
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
            value: 'camera=(self), microphone=(self), geolocation=()',
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
              // Daily's bundled call-object loader fetches its CDN code; its
              // signaling sockets use both *.wss and *-wss hostnames. Include
              // the documented fallback domains without allowing arbitrary WSS.
              "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com https://api.stripe.com https://*.daily.co https://*.dailywebrtc.com https://*.dailywebrtc.net https://prod-ks.pluot.blue wss://*.daily.co wss://*.dailywebrtc.com wss://*.dailywebrtc.net",
              "worker-src 'self' blob:",
              "media-src 'self' blob: https://*.supabase.co",
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
    loader: 'custom',
    loaderFile: './src/lib/files/imageLoader.ts',
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

      // Vendor product CDNs (homepage boost reel — see scripts/audit-tagged-product-images.ts).
      // Adding a new hostname here is the unblock for "Product.imageUrl is set
      // but next/image renders nothing" cases. When extending: run the audit,
      // copy the unwhitelisted hostnames from the OK bucket.
      { protocol: 'https', hostname: 'cdn.roveconcepts.com', pathname: '/**' },
      { protocol: 'https', hostname: 'assets.wfcdn.com', pathname: '/**' }, // Wayfair CDN
      { protocol: 'https', hostname: 'cdn.shopify.com', pathname: '/**' },
      { protocol: 'https', hostname: 'source.unsplash.com', pathname: '/**' }, // distinct from images.unsplash.com
      { protocol: 'https', hostname: 'basstonenyc.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.designshop.com', pathname: '/**' },

      // Additional editorial/press domains can be added here as needed
    ],
    formats: ['image/avif', 'image/webp'],
  },
};

module.exports = nextConfig;
