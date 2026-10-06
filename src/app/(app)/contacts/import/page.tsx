import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ImportWizard } from "./ImportWizard";

export const metadata = { title: "CSV取込" };

export default async function ImportPage() {
  await requireUser();
  return (
    <div>
      <PageHeader
        title="繋がりリスト CSV取込"
        description="CSV（UTF-8 / Shift_JIS）を選び、列を対応付けて取り込みます。重複は取込前に確認できます。"
      />
      <ImportWizard />
    </div>
  );
}
