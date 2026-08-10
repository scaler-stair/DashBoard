import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getSession, activeOrgId, canUpdateStatus } from "@/lib/auth";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUpdateStatus(session.role)) {
    return NextResponse.json({ error: "Your role cannot update observation status" }, { status: 403 });
  }
  const orgId = await activeOrgId(session);
  const { id } = await ctx.params;
  const { status, owner, due_date } = (await req.json()) as {
    status?: string;
    owner?: string;
    due_date?: string;
  };
  if (status && !["Open", "In Progress", "Closed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const sql = getSql();
  const existing = await sql`
    SELECT id FROM observations WHERE id = ${Number(id)} AND org_id = ${orgId}`;
  if (existing.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await sql`
    UPDATE observations
    SET status = COALESCE(${status ?? null}, status),
        owner = COALESCE(${owner ?? null}, owner),
        due_date = COALESCE(${due_date ?? null}, due_date)
    WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
