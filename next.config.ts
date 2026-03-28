import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    browsersListForSwc: true,
  },
};

export default nextConfig;
