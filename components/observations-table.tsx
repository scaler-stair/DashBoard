"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SourceViewer, type SourceTarget } from "@/components/source-viewer";
import { searchTextFor } from "@/lib/pdf-match";

export type ObsRow = {
  id: number;
  report_id: number;
  title: string;
  description: string | null;
  department: string | null;
  risk: string | null;
  recommendation: string | null;
  status: string;
  owner: string | null;
  due_date: string | null;
  source_page: number | null;
  source_quote: string | null;
  quarter: string;
  fiscal_year: string;
  report_title: string;
};

const RISK_TONE: Record<string, string> = {
  High: "var(--status-critical)",
  Medium: "var(--status-warning)",
  Low: "var(--status-good)",
};

export type ObsFilters = {
  quarter?: string;
  dept?: string;
  risk?: string;
  status?: string;
};

export function ObservationsTable({
  rows,
  canEdit,
  initialFilters = {},
}: {
  rows: ObsRow[];
  canEdit: boolean;
  initialFilters?: ObsFilters;
}) {
  const router = useRouter();
  const [quarter, setQuarter] = useState(initialFilters.quarter ?? "all");
  const [dept, setDept] = useState(initialFilters.dept ?? "all");
  const [risk, setRisk] = useState(initialFilters.risk ?? "all");
  const [status, setStatus] = useState(initialFilters.status ?? "all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [source, setSource] = useState<SourceTarget | null>(null);

  function openSource(r: ObsRow) {
    setSource({
      observationId: r.id,
      observationTitle: r.title,
      reportId: r.report_id,
      reportTitle: r.report_title,
      quarterLabel: `${r.quarter} ${r.fiscal_year}`,
      quote: r.source_quote,
      page: r.source_page,
      searchText: searchTextFor(r),
    });
  }

  const quarters = useMemo(() => [...new Set(rows.map((r) => `${r.quarter} ${r.fiscal_year}`))], [rows]);
  const depts = useMemo(() => [...new Set(rows.map((r) => r.department).filter(Boolean))] as string[], [rows]);

  const filtered = rows.filter(
    (r) =>
      (quarter === "all" || `${r.quarter} ${r.fiscal_year}` === quarter) &&
      (dept === "all" || r.department === dept) &&
      (risk === "all" || r.risk === risk) &&
      (status === "all" || r.status === status)
  );

  async function updateStatus(id: number, newStatus: string) {
    await fetch(`/api/observations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  const selectStyle = { borderColor: "var(--grid)", background: "var(--surface-1)" };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="border rounded-lg px-2 py-1" style={selectStyle}>
          <option value="all">All quarters</option>
          {quarters.map((q) => <option key={q}>{q}</option>)}
        </select>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="border rounded-lg px-2 py-1" style={selectStyle}>
          <option value="all">All departments</option>
          {depts.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={risk} onChange={(e) => setRisk(e.target.value)} className="border rounded-lg px-2 py-1" style={selectStyle}>
          <option value="all">All risks</option>
          <option>High</option><option>Medium</option><option>Low</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-lg px-2 py-1" style={selectStyle}>
          <option value="all">All statuses</option>
          <option>Open</option><option>In Progress</option><option>Closed</option>
        </select>
        <span className="ml-auto self-center text-xs" style={{ color: "var(--muted)" }}>
          {filtered.length} of {rows.length} observations
        </span>
      </div>

      <div className="rounded-2xl border overflow-x-auto" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <th className="px-4 py-3">Observation</th>
              <th className="px-4 py-3">Quarter</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <Fragment key={r.id}>
                <tr
                  className="border-t cursor-pointer align-top"
                  style={{ borderColor: "var(--grid)" }}
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <td className="px-4 py-3 font-medium max-w-md">
                    <span className="flex items-start gap-2">
                      <span className="min-w-0">{r.title}</span>
                      <button
                        type="button"
                        title="View the passage in the source report"
                        aria-label={`View the source passage for ${r.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openSource(r);
                        }}
                        className="mt-0.5 shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
                        style={{ color: "var(--accent)" }}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" strokeLinejoin="round" />
                          <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--ink-2)" }}>{r.quarter} {r.fiscal_year}</td>
                  <td className="px-4 py-3" style={{ color: "var(--ink-2)" }}>{r.department}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: RISK_TONE[r.risk ?? ""] ?? "var(--muted)" }} />
                      {r.risk}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {canEdit ? (
                      <select
                        value={r.status}
                        onChange={(e) => updateStatus(r.id, e.target.value)}
                        className="border rounded-lg px-2 py-1 text-xs"
                        style={selectStyle}
                      >
                        <option>Open</option><option>In Progress</option><option>Closed</option>
                      </select>
                    ) : (
                      r.status
                    )}
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr className="border-t" style={{ borderColor: "var(--grid)", background: "var(--page)" }}>
                    <td colSpan={5} className="px-4 py-3 text-sm space-y-2">
                      {r.description && <p><span className="font-semibold">Observation:</span> {r.description}</p>}
                      {r.recommendation && <p><span className="font-semibold">Recommendation:</span> {r.recommendation}</p>}
                      <p style={{ color: "var(--ink-2)" }}>
                        {r.owner ? `Owner: ${r.owner}. ` : ""}
                        {r.due_date ? `Due: ${r.due_date}.` : ""}
                      </p>
                      {r.source_quote && (
                        <blockquote
                          className="rounded-lg border-l-4 px-3 py-2 text-xs leading-relaxed"
                          style={{ borderColor: "var(--status-warning)", background: "var(--surface-1)", color: "var(--ink-2)" }}
                        >
                          <span className="font-semibold" style={{ color: "var(--ink)" }}>From the report: </span>
                          &ldquo;{r.source_quote}&rdquo;
                        </blockquote>
                      )}
                      <button
                        type="button"
                        onClick={() => openSource(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                        style={{ background: "var(--accent)" }}
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" strokeLinejoin="round" />
                          <path d="M14 3v5h5" strokeLinejoin="round" />
                        </svg>
                        View in source report{r.source_page ? ` · page ${r.source_page}` : ""}
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>No observations match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <SourceViewer target={source} onClose={() => setSource(null)} />
    </div>
  );
}
