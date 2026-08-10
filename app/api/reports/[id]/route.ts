import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { signedPdfUrl, deletePdf } from "@/lib/storage";
import { getSession, activeOrgId, canUpload } from "@/lib/auth";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await activeOrgId(session);
  const { id } = await ctx.params;
  const sql = getSql();
  const rows = await sql`
    SELECT id, file_path, title FROM reports WHERE id = ${Number(id)} AND org_id = ${orgId}`;
  const report = rows[0] as { id: number; file_path: string; title: string } | undefined;
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const url = await signedPdfUrl(report.file_path);
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUpload(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const orgId = await activeOrgId(session);
  const { id } = await ctx.params;
  const sql = getSql();
  const rows = await sql`
    SELECT id, file_path FROM reports WHERE id = ${Number(id)} AND org_id = ${orgId}`;
  const report = rows[0] as { id: number; file_path: string } | undefined;
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await sql`DELETE FROM reports WHERE id = ${report.id}`;
  try {
    await deletePdf(report.file_path);
  } catch (err) {
    console.error("Storage delete failed (DB row already removed):", err);
  }
  return NextResponse.json({ ok: true });
}
