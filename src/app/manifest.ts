import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "紹介案件管理",
    short_name: "紹介案件管理",
    description: "ベンダーMTG・紹介案件・報酬の管理ツール",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6fa",
    theme_color: "#1b2338",
    lang: "ja",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
