import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";
import { CreateUserForm, UserRow } from "./UserForms";

export const metadata = { title: "ユーザー管理" };

export default async function UsersPage() {
  await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: [{ isActive: "desc" }, { id: "asc" }] });
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card title="ユーザー一覧">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>ログインID</th>
                  <th>氏名</th>
                  <th>権限</th>
                  <th>LINE</th>
                  <th>状態</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow
                    key={u.id}
                    user={{ id: u.id, loginId: u.loginId, name: u.name, role: u.role, isActive: u.isActive, lineLinked: !!u.lineUserId }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <div>
        <Card title="ユーザーを追加">
          <CreateUserForm />
        </Card>
      </div>
    </div>
  );
}
