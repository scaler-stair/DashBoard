import { NextRequest, NextResponse } from "next/server";
import { getSql, vectorLiteral } from "@/lib/db";
import { uploadPdf, ensureBucket, deletePdf } from "@/lib/storage";
import { getSession, activeOrgId, canUpload } from "@/lib/auth";
import { extractObservations, embedTexts } from "@/lib/ai";

export const maxDuration = 300;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await activeOrgId(session);
  const sql = getSql();
  const reports = await sql`
    SELECT id, quarter, fiscal_year, title, summary, status, error,
           to_char(created_at, 'YYYY-MM-DD HH24:MI') AS created_at
    FROM reports WHERE org_id = ${orgId} ORDER BY fiscal_year, quarter`;
  return NextResponse.json({ reports });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUpload(session.role)) {
    return NextResponse.json({ error: "Your role cannot upload reports" }, { status: 403 });
  }
  const orgId = await activeOrgId(session);
  if (!orgId) return NextResponse.json({ error: "No organization selected" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file");
  const quarter = String(form.get("quarter") ?? "");
  const fiscalYear = String(form.get("fiscal_year") ?? "");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "A PDF file is required" }, { status: 400 });
  }
  if (!/^Q[1-4]$/.test(quarter) || !fiscalYear) {
    return NextResponse.json({ error: "Quarter (Q1-Q4) and fiscal year are required" }, { status: 400 });
  }

  const sql = getSql();
  const existing = await sql`
    SELECT id, status, file_path FROM reports WHERE org_id = ${orgId} AND quarter = ${quarter} AND fiscal_year = ${fiscalYear}`;
  if (existing.length > 0) {
    const prev = existing[0] as { id: number; status: string; file_path: string };
    if (prev.status !== "failed") {
      return NextResponse.json(
        { error: `A ${quarter} ${fiscalYear} report already exists for this organization. Delete it first to re-upload.` },
        { status: 409 }
      );
    }
    // A failed extraction leaves no usable data; replace it silently on re-upload.
    await sql`DELETE FROM reports WHERE id = ${prev.id}`;
    try {
      await deletePdf(prev.file_path);
    } catch {}
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const pathKey = `org-${orgId}/${fiscalYear}-${quarter}-${Date.now()}.pdf`;
  await ensureBucket();
  await uploadPdf(pathKey, buffer);

  const inserted = await sql`
    INSERT INTO reports (org_id, quarter, fiscal_year, title, file_path, status, uploaded_by)
    VALUES (${orgId}, ${quarter}, ${fiscalYear}, ${file.name.replace(/\.pdf$/i, "")}, ${pathKey}, 'processing', ${session.userId})
    RETURNING id`;
  const reportId = inserted[0].id as number;

  try {
    const result = await extractObservations(buffer);
    const obsIds: number[] = [];
    const texts: string[] = [];
    for (const o of result.observations) {
      const risk = ["High", "Medium", "Low"].includes(o.risk) ? o.risk : "Medium";
      const status = ["Open", "In Progress", "Closed"].includes(o.status) ? o.status : "Open";
      const sourcePage = Number.isInteger(o.source_page) && o.source_page > 0 ? o.source_page : null;
      const r = await sql`
        INSERT INTO observations (org_id, report_id, title, description, department, risk, recommendation, management_response, status, owner, due_date, source_page, source_quote)
        VALUES (${orgId}, ${reportId}, ${o.title}, ${o.description ?? ""}, ${o.department ?? "General"}, ${risk},
                ${o.recommendation ?? ""}, ${o.management_response ?? ""}, ${status}, ${o.owner ?? ""}, ${o.due_date ?? ""},
                ${sourcePage}, ${o.source_quote ?? ""})
        RETURNING id`;
      obsIds.push(r[0].id as number);
      texts.push(`${o.title}. ${o.description ?? ""} Recommendation: ${o.recommendation ?? ""}`);
    }

    // Embeddings are best-effort: the chatbot still works from the structured
    // context if the embedding call fails.
    try {
      const vectors = await embedTexts([result.summary, ...texts]);
      await sql`
        INSERT INTO chunks (org_id, report_id, observation_id, text, embedding)
        VALUES (${orgId}, ${reportId}, ${null}, ${result.summary}, ${vectorLiteral(vectors[0] ?? [])}::vector)`;
      for (let i = 0; i < texts.length; i++) {
        await sql`
          INSERT INTO chunks (org_id, report_id, observation_id, text, embedding)
          VALUES (${orgId}, ${reportId}, ${obsIds[i]}, ${texts[i]}, ${vectorLiteral(vectors[i + 1] ?? [])}::vector)`;
      }
    } catch (embedErr) {
      console.error("Embedding failed (chatbot falls back to structured context):", embedErr);
    }

    await sql`UPDATE reports SET status = 'ready', summary = ${result.summary} WHERE id = ${reportId}`;
    return NextResponse.json({ ok: true, reportId, observations: result.observations.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sql`UPDATE reports SET status = 'failed', error = ${message} WHERE id = ${reportId}`;
    return NextResponse.json({ error: `AI processing failed: ${message}` }, { status: 502 });
  }
}
