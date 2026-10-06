import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "紹介案件管理", template: "%s | 紹介案件管理" },
  description: "ベンダーMTG・紹介案件・報酬の管理ツール",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
