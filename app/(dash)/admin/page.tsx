import { redirect } from "next/navigation";
import { getSession, canManageUsers } from "@/lib/auth";
import { AdminPanel } from "@/components/admin-panel";

export default async function AdminPage() {
  const session = (await getSession())!;
  if (!canManageUsers(session.role)) redirect("/");
  return <AdminPanel isSuperAdmin={session.role === "super_admin"} />;
}
