import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/universal-jumps/sucursal/:id",
        destination: "/universal-jumps/franquicia/:id",
        permanent: true,
      },
      {
        source: "/universal-jumps/sucursal/:id/:path*",
        destination: "/universal-jumps/franquicia/:id/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
