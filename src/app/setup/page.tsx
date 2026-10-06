import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SetupForm } from "./SetupForm";

export const metadata = { title: "初期セットアップ" };

export default async function SetupPage() {
  const count = await prisma.user.count();
  if (count > 0) redirect("/login");
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-lg font-semibold text-gray-900">紹介案件管理 初期セットアップ</div>
          <div className="text-xs text-gray-500 mt-1">最初の管理者アカウントを作成します。この画面はユーザーがいない間だけ表示されます。</div>
        </div>
        <SetupForm />
      </div>
    </main>
  );
}
