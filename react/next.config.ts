import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow iPhone and other devices on local network to access dev server
  allowedDevOrigins: ['10.0.0.47'],
  // Only enable static export for production builds (not in dev mode)
  // This allows API routes to work in development
  // API routes are automatically excluded from static exports
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  // Set trailing slash for GitHub Pages compatibility
  trailingSlash: true,
};

export default nextConfig;
