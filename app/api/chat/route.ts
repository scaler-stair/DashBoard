import { NextRequest, NextResponse } from "next/server";
import { getSession, activeOrgId } from "@/lib/auth";
import { getSql, vectorLiteral } from "@/lib/db";
import { buildChatContext } from "@/lib/stats";
import { chatAnswer, embedTexts } from "@/lib/ai";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await activeOrgId(session);
  if (!orgId) return NextResponse.json({ error: "No organization selected" }, { status: 400 });

  const { question, history } = (await req.json()) as {
    question?: string;
    history?: Array<{ role: "user" | "model"; text: string }>;
  };
  if (!question?.trim()) return NextResponse.json({ error: "Question required" }, { status: 400 });

  const sql = getSql();
  const orgRows = await sql`SELECT name FROM orgs WHERE id = ${orgId}`;
  const countRows = await sql`
    SELECT COUNT(*)::int AS n FROM reports WHERE org_id = ${orgId} AND status = 'ready'`;
  if ((countRows[0].n as number) === 0) {
    return NextResponse.json({
      answer:
        "No audit reports have been processed for this organization yet. Upload a quarterly audit PDF from the Admin page first.",
    });
  }

  // Primary grounding: the full structured observation set (small enough to inline).
  let context = await buildChatContext(orgId, (orgRows[0]?.name as string) ?? "Organization");

  // Semantic retrieval adds the most relevant raw excerpts on top; best-effort.
  try {
    const [qVec] = await embedTexts([question]);
    const top = await sql`
      SELECT text FROM chunks
      WHERE org_id = ${orgId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral(qVec)}::vector
      LIMIT 5`;
    if (top.length > 0) {
      context +=
        "\n\n## Most relevant excerpts for this question\n" +
        top.map((t) => `- ${t.text as string}`).join("\n");
    }
  } catch (err) {
    console.error("Retrieval skipped:", err);
  }

  try {
    const answer = await chatAnswer(question, context, history ?? []);
    return NextResponse.json({ answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
