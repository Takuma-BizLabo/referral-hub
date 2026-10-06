import type { Metadata, Viewport } from "next";
import "./globals.css";

const APP_NAME = "紹介案件管理";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "ベンダーMTG・紹介案件・報酬の管理ツール",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  // 社内ツールのため検索エンジンに載せない
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b2338",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
