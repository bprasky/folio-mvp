/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable automatic file watching that might revert changes
  experimental: {
    turbo: {
      watchOptions: {
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**']
      }
    }
  },
  // Disable automatic static optimization to prevent file overwrites
  staticPageGenerationTimeout: 60,
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
    domains: [
      'source.unsplash.com',
      'images.unsplash.com',
      'randomuser.me',
      'cdn.prod.website-files.com',
      'images.squarespace-cdn.com',
      'static1.squarespace.com',
      'assets.squarespace.com',
      'www.mesonart.com',
      'mesonart.com',
      's3.img-b.com',
      'cb.scene7.com',
      'cdn.roveconcepts.com',
      'res.cloudinary.com',
      'build.com',
      'cdn.shopify.com',
      'i.imgur.com',
      'via.placeholder.com',
      's3.amazonaws.com'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.squarespace-cdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.squarespace.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.shopify.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
        pathname: '/**',
      }
    ],
    dangerouslyAllowSVG: true,
    minimumCacheTTL: 60,
    unoptimized: false,
  },
};

module.exports = nextConfig;
