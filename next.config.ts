import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.CAPACITOR_BUILD === 'true' ? 'export' : undefined
};

export default nextConfig;
