import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ImportWizard } from "./ImportWizard";
import { importBundledCompaniesAction } from "../actions";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "CSV取込" };

export default async function ImportPage() {
  const user = await requireUser();
  return (
    <div>
      <PageHeader
        title="繋がりリスト CSV取込"
        description="CSV（UTF-8 / Shift_JIS）を選び、列を対応付けて取り込みます。重複は取込前に確認できます。"
      />
      {user.role === "ADMIN" && (
        <Card title="スプレッドシートの会社リストを取り込む（管理者）" className="mb-4">
          <p className="text-sm text-gray-700 mb-3">
            ツールに同梱している「セールスハブ掲載済み 159社」を繋がりリストへ取り込みます。スプレッドシートの繋がりリストは担当者名などの補完にだけ使い、セールスハブ未掲載の会社は取り込みません（何度実行しても重複しません）。
          </p>
          <form action={importBundledCompaniesAction}>
            <SubmitButton className="btn-primary">同梱の会社リストを取り込む</SubmitButton>
          </form>
        </Card>
      )}
      <ImportWizard />
    </div>
  );
}
