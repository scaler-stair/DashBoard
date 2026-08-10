import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** Super admin: list orgs and switch the active org (stored in a cookie). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sql = getSql();
  const orgs = await sql`SELECT id, name, slug FROM orgs ORDER BY name`;
  return NextResponse.json({ orgs });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { orgId, name } = (await req.json()) as { orgId?: number; name?: string };
  const sql = getSql();

  if (name?.trim()) {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    try {
      const rows = await sql`
        INSERT INTO orgs (name, slug) VALUES (${name.trim()}, ${slug}) RETURNING id`;
      return NextResponse.json({ ok: true, orgId: rows[0].id });
    } catch {
      return NextResponse.json({ error: "An organization with that name already exists" }, { status: 409 });
    }
  }

  const org = await sql`SELECT id FROM orgs WHERE id = ${Number(orgId)}`;
  if (org.length === 0) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("activeOrg", String(orgId), { path: "/", maxAge: 30 * 24 * 3600 });
  return res;
}
