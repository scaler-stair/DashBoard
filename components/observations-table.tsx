"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type ObsRow = {
  id: number;
  title: string;
  description: string | null;
  department: string | null;
  risk: string | null;
  recommendation: string | null;
  status: string;
  owner: string | null;
  due_date: string | null;
  quarter: string;
  fiscal_year: string;
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
                  <td className="px-4 py-3 font-medium max-w-md">{r.title}</td>
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
    </div>
  );
}
