import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function SettingsIndex() {
  const user = await requireUser();
  redirect(user.role === "ADMIN" ? "/settings/users" : "/settings/line");
}
