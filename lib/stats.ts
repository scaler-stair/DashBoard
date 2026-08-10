import { getSql } from "./db";

export type ObservationRow = {
  id: number;
  report_id: number;
  title: string;
  description: string | null;
  department: string | null;
  risk: "High" | "Medium" | "Low" | null;
  recommendation: string | null;
  management_response: string | null;
  status: "Open" | "In Progress" | "Closed";
  owner: string | null;
  due_date: string | null;
  quarter: string;
  fiscal_year: string;
};

export async function orgObservations(orgId: number): Promise<ObservationRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT o.id, o.report_id, o.title, o.description, o.department, o.risk,
           o.recommendation, o.management_response, o.status, o.owner, o.due_date,
           r.quarter, r.fiscal_year
    FROM observations o JOIN reports r ON r.id = o.report_id
    WHERE o.org_id = ${orgId} AND r.status = 'ready'
    ORDER BY r.fiscal_year, r.quarter, o.id`;
  return rows as unknown as ObservationRow[];
}

export function quarterLabel(o: { quarter: string; fiscal_year: string }): string {
  return `${o.quarter} ${o.fiscal_year}`;
}

export function kpis(rows: ObservationRow[]) {
  const count = (fn: (o: ObservationRow) => boolean) => rows.filter(fn).length;
  return {
    total: rows.length,
    open: count((o) => o.status === "Open"),
    inProgress: count((o) => o.status === "In Progress"),
    closed: count((o) => o.status === "Closed"),
    high: count((o) => o.risk === "High"),
    medium: count((o) => o.risk === "Medium"),
    low: count((o) => o.risk === "Low"),
    departments: new Set(rows.map((o) => o.department).filter(Boolean)).size,
  };
}

export function groupCount<T extends string>(rows: ObservationRow[], key: (o: ObservationRow) => T | null) {
  const map = new Map<T, number>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

export function quarterTrend(rows: ObservationRow[]) {
  const quarters = [...new Set(rows.map(quarterLabel))];
  return quarters.map((q) => {
    const inQ = rows.filter((o) => quarterLabel(o) === q);
    return {
      quarter: q,
      total: inQ.length,
      high: inQ.filter((o) => o.risk === "High").length,
      open: inQ.filter((o) => o.status !== "Closed").length,
      closed: inQ.filter((o) => o.status === "Closed").length,
    };
  });
}

function normalizeWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

const REPEAT_THRESHOLD = 0.45;

/** Match observations across two quarters by title+description word overlap. */
export function compareQuarters(rows: ObservationRow[], quarterA: string, quarterB: string) {
  const a = rows.filter((o) => quarterLabel(o) === quarterA);
  const b = rows.filter((o) => quarterLabel(o) === quarterB);
  const wordsOf = (o: ObservationRow) => normalizeWords(`${o.title} ${o.description ?? ""}`);
  const aWords = a.map(wordsOf);
  const bWords = b.map(wordsOf);

  const repeats: Array<{ from: ObservationRow; to: ObservationRow; similarity: number }> = [];
  const matchedB = new Set<number>();
  a.forEach((oa, i) => {
    let best = -1;
    let bestSim = 0;
    bWords.forEach((wb, j) => {
      if (matchedB.has(j)) return;
      const sim = jaccard(aWords[i], wb);
      if (sim > bestSim) {
        bestSim = sim;
        best = j;
      }
    });
    if (best >= 0 && bestSim >= REPEAT_THRESHOLD) {
      matchedB.add(best);
      repeats.push({ from: oa, to: b[best], similarity: Math.round(bestSim * 100) / 100 });
    }
  });

  const repeatedFromA = new Set(repeats.map((r) => r.from.id));
  const resolved = a.filter((o) => !repeatedFromA.has(o.id));
  const fresh = b.filter((_, j) => !matchedB.has(j));
  const escalated = repeats.filter((r) => riskRank(r.to.risk) > riskRank(r.from.risk));

  return { a, b, repeats, resolved, fresh, escalated };
}

function riskRank(risk: string | null): number {
  return risk === "High" ? 3 : risk === "Medium" ? 2 : risk === "Low" ? 1 : 0;
}

/** Compact, token-efficient context for the chatbot: every observation + report summaries. */
export async function buildChatContext(orgId: number, orgName: string): Promise<string> {
  const sql = getSql();
  const reports = (await sql`
    SELECT quarter, fiscal_year, title, summary FROM reports
    WHERE org_id = ${orgId} AND status = 'ready'
    ORDER BY fiscal_year, quarter`) as unknown as Array<{
    quarter: string;
    fiscal_year: string;
    title: string;
    summary: string | null;
  }>;
  const rows = await orgObservations(orgId);
  const k = kpis(rows);

  const lines: string[] = [];
  lines.push(`Organization: ${orgName}`);
  lines.push(
    `Overall: ${k.total} observations across ${reports.length} quarterly reports. ` +
      `Status: ${k.open} Open, ${k.inProgress} In Progress, ${k.closed} Closed. ` +
      `Risk: ${k.high} High, ${k.medium} Medium, ${k.low} Low.`
  );
  for (const r of reports) {
    lines.push(`\n## Report ${r.quarter} ${r.fiscal_year}: ${r.title}`);
    if (r.summary) lines.push(`Summary: ${r.summary}`);
    const inQ = rows.filter((o) => o.quarter === r.quarter && o.fiscal_year === r.fiscal_year);
    inQ.forEach((o, i) => {
      lines.push(
        `${i + 1}. [${o.risk ?? "?"} | ${o.status} | ${o.department ?? "General"}] ${o.title}` +
          (o.description ? ` — ${o.description}` : "") +
          (o.recommendation ? ` Recommendation: ${o.recommendation}` : "") +
          (o.owner ? ` Owner: ${o.owner}.` : "") +
          (o.due_date ? ` Due: ${o.due_date}.` : "")
      );
    });
  }
  return lines.join("\n");
}
