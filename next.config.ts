import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/dnuxz94n5/image/upload/**",
      },
    ],
  },
};

export default nextConfig;
