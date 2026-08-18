import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { downloadPdf } from "@/lib/storage";
import { getSession, activeOrgId } from "@/lib/auth";

/**
 * Streams the report PDF from the same origin so the in-app viewer can read it
 * with fetch/pdf.js. The signed-URL redirect on the parent route is for opening
 * the file in a new tab; this one is for rendering it inside the dashboard.
 */
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
    const buffer = await downloadPdf(report.file_path);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename="${report.title.replace(/"/g, "")}.pdf"`,
        // Org-scoped and session-checked, so never cache in a shared cache.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
