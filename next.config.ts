import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // タスクの添付ファイル（1ファイル10MB・合計25MB）を送れるようにする
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
