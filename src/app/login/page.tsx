import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  if ((await prisma.user.count()) === 0) redirect("/setup");
  const { next } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-lg font-semibold text-gray-900">紹介案件管理</div>
          <div className="text-xs text-gray-500 mt-1">ベンダーMTG・紹介案件・報酬</div>
        </div>
        <LoginForm next={next ?? ""} />
        <p className="text-xs text-gray-500 text-center mt-4 leading-relaxed">
          IDとパスワードは管理者から受け取ってください。
          <br />
          忘れたときも管理者に再発行を依頼してください。
        </p>
      </div>
    </main>
  );
}
