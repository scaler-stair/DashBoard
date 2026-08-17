import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { uploadLogo } from "@/lib/storage";
import { logoError } from "@/lib/logos";

/** Super admin: list orgs and switch the active org (stored in a cookie). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sql = getSql();
  const orgs = await sql`SELECT id, name, slug, logo_url FROM orgs ORDER BY name`;
  return NextResponse.json({ orgs });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let orgId: number | undefined;
  let name: string | undefined;
  let logo: File | null = null;

  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await req.formData();
    name = form.get("name")?.toString();
    const rawOrgId = form.get("orgId")?.toString();
    if (rawOrgId) orgId = Number(rawOrgId);
    const candidate = form.get("logo");
    if (candidate instanceof File && candidate.size > 0) logo = candidate;
  } else {
    ({ orgId, name } = (await req.json()) as { orgId?: number; name?: string });
  }

  const sql = getSql();

  if (name?.trim()) {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) {
      return NextResponse.json({ error: "Organization name must contain letters or numbers" }, { status: 400 });
    }
    if (logo) {
      const bad = logoError(logo);
      if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    }
    let newOrgId: number;
    try {
      const rows = await sql`
        INSERT INTO orgs (name, slug) VALUES (${name.trim()}, ${slug}) RETURNING id`;
      newOrgId = rows[0].id as number;
    } catch {
      return NextResponse.json({ error: "An organization with that name already exists" }, { status: 409 });
    }
    // After the insert, so a rejected duplicate can never overwrite an existing org's logo.
    let logoUrl: string | null = null;
    if (logo) {
      logoUrl = await uploadLogo(slug, logo);
      if (logoUrl) await sql`UPDATE orgs SET logo_url = ${logoUrl} WHERE id = ${newOrgId}`;
    }
    return NextResponse.json({
      ok: true,
      orgId: newOrgId,
      logoUrl,
      logoWarning: logo && !logoUrl ? "The organization was created, but the logo could not be stored." : null,
    });
  }

  const org = await sql`SELECT id FROM orgs WHERE id = ${Number(orgId)}`;
  if (org.length === 0) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("activeOrg", String(orgId), { path: "/", maxAge: 30 * 24 * 3600 });
  return res;
}
