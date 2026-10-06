import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { cleanParams } from "@/lib/params";
import { ContactForm } from "../ContactForm";

export const metadata = { title: "繋がり追加" };

export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  await requireUser();
  const { company } = cleanParams(await searchParams);
  const allTags = (await prisma.tag.findMany({ orderBy: { name: "asc" } })).map((t) => t.name);
  return (
    <div>
      <PageHeader title="繋がりを追加" />
      <ContactForm allTags={allTags} defaultCompany={company} />
    </div>
  );
}
