import { redirect } from "next/navigation";
import { getSession, activeOrgId } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { Nav } from "@/components/nav";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const orgId = await activeOrgId(session);
  const sql = getSql();
  const orgRows = orgId ? await sql`SELECT name, logo_url FROM orgs WHERE id = ${orgId}` : [];
  const orgs =
    session.role === "super_admin"
      ? ((await sql`SELECT id, name FROM orgs ORDER BY name`) as unknown as Array<{ id: number; name: string }>)
      : [];

  return (
    <div className="min-h-screen">
      <Nav
        userName={session.name}
        orgName={(orgRows[0]?.name as string) ?? session.orgName ?? "No organization"}
        orgLogo={(orgRows[0]?.logo_url as string | null) ?? null}
        role={session.role}
        orgs={orgs}
        activeOrg={orgId}
      />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
