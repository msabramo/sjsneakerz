import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow iPhone and other devices on local network to access dev server
  allowedDevOrigins: ['10.0.0.47'],
  // Enable static export for GitHub Pages
  output: 'export',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  // Set trailing slash for GitHub Pages compatibility
  trailingSlash: true,
};

export default nextConfig;
