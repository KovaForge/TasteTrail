import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tastetrail/shared", "@tastetrail/server"],
  typedRoutes: true,
};

export default nextConfig;
