import { getSession, activeOrgId, canUpload } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { DeleteReportButton } from "@/components/report-actions";

type ReportRow = {
  id: number;
  quarter: string;
  fiscal_year: string;
  title: string;
  summary: string | null;
  status: string;
  error: string | null;
  created_at: string;
  obs_count: number;
};

export default async function ReportsPage() {
  const session = (await getSession())!;
  const orgId = await activeOrgId(session);
  const reports = orgId
    ? ((await getSql()`
        SELECT r.id, r.quarter, r.fiscal_year, r.title, r.summary, r.status, r.error,
               to_char(r.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
               (SELECT COUNT(*)::int FROM observations o WHERE o.report_id = r.id) AS obs_count
        FROM reports r WHERE r.org_id = ${orgId} ORDER BY r.fiscal_year, r.quarter`) as unknown as ReportRow[])
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      {reports.length === 0 && (
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>No reports uploaded yet. Use the Admin page to upload a quarterly audit PDF.</p>
      )}
      <div className="grid gap-4">
        {reports.map((r) => (
          <section key={r.id} className="rounded-2xl border p-5" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">
                  {r.quarter} {r.fiscal_year} — {r.title}
                </h2>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  Uploaded {r.created_at} ·{" "}
                  {r.status === "ready"
                    ? `${r.obs_count} observations extracted`
                    : r.status === "processing"
                    ? "Processing…"
                    : `Failed: ${r.error}`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm whitespace-nowrap">
                <a href={`/api/reports/${r.id}`} target="_blank" className="underline" style={{ color: "var(--accent)" }}>
                  View PDF
                </a>
                {canUpload(session.role) && <DeleteReportButton id={r.id} />}
              </div>
            </div>
            {r.summary && (
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>{r.summary}</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
