import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ContactForm } from "../../ContactForm";
import { idParam } from "@/lib/params";

export const metadata = { title: "繋がり編集" };

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const contact = await prisma.contact.findUnique({ where: { id: idParam(id) }, include: { tags: { include: { tag: true } } } });
  if (!contact) notFound();
  const allTags = (await prisma.tag.findMany({ orderBy: { name: "asc" } })).map((t) => t.name);
  return (
    <div>
      <PageHeader title={`繋がり編集：${contact.name}`} />
      <ContactForm contact={contact} tags={contact.tags.map((t) => t.tag.name)} allTags={allTags} />
    </div>
  );
}
