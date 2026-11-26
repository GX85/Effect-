import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: process.env.FOCUS_STATIC_EXPORT === '1' ? 'export' : undefined,
  trailingSlash: false,
};

export default nextConfig;
