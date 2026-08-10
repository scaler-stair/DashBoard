import Link from "next/link";
import { getSession, activeOrgId } from "@/lib/auth";
import { orgObservations, compareQuarters, quarterLabel, ObservationRow } from "@/lib/stats";

function Pill({ risk }: { risk: string | null }) {
  const tone =
    risk === "High" ? "var(--status-critical)" : risk === "Medium" ? "var(--status-warning)" : "var(--status-good)";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
      <span className="h-2 w-2 rounded-full inline-block" style={{ background: tone }} />
      {risk}
    </span>
  );
}

function ObsList({ title, items, tone }: { title: string; items: ObservationRow[]; tone: string }) {
  return (
    <section className="rounded-2xl border p-5" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: tone }} />
        {title} <span style={{ color: "var(--muted)" }}>({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>None.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-3 border-t pt-2 first:border-t-0 first:pt-0" style={{ borderColor: "var(--grid)" }}>
              <span>
                <span className="font-medium">{o.title}</span>
                {o.department && <span style={{ color: "var(--muted)" }}> · {o.department}</span>}
              </span>
              <Pill risk={o.risk} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const session = (await getSession())!;
  const orgId = await activeOrgId(session);
  const rows = orgId ? await orgObservations(orgId) : [];
  const quarters = [...new Set(rows.map(quarterLabel))];
  const params = await searchParams;

  if (quarters.length < 2) {
    return (
      <div className="rounded-2xl border p-10 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <h1 className="text-lg font-semibold">Quarter comparison needs at least two processed reports</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
          {quarters.length === 0 ? "No reports processed yet." : `Only ${quarters[0]} is available so far.`} Upload more quarters from the Admin page.
        </p>
      </div>
    );
  }

  const a = params.a && quarters.includes(params.a) ? params.a : quarters[quarters.length - 2];
  const b = params.b && quarters.includes(params.b) ? params.b : quarters[quarters.length - 1];
  const cmp = compareQuarters(rows, a, b);

  const highA = cmp.a.filter((o) => o.risk === "High").length;
  const highB = cmp.b.filter((o) => o.risk === "High").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Compare Quarters</h1>
        <form className="flex items-center gap-2 text-sm">
          <select name="a" defaultValue={a} className="border rounded-lg px-2 py-1" style={{ borderColor: "var(--grid)", background: "var(--surface-1)" }}>
            {quarters.map((q) => <option key={q}>{q}</option>)}
          </select>
          <span style={{ color: "var(--muted)" }}>vs</span>
          <select name="b" defaultValue={b} className="border rounded-lg px-2 py-1" style={{ borderColor: "var(--grid)", background: "var(--surface-1)" }}>
            {quarters.map((q) => <option key={q}>{q}</option>)}
          </select>
          <button type="submit" className="rounded-lg px-3 py-1 text-white" style={{ background: "var(--accent)" }}>Compare</button>
        </form>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: `${a} observations`, value: cmp.a.length },
          { label: `${b} observations`, value: cmp.b.length },
          { label: `High risk: ${a} → ${b}`, value: `${highA} → ${highB}` },
          {
            label: "High-risk change",
            value: highA === 0 ? "n/a" : `${Math.round(((highA - highB) / highA) * 100)}% ${highB <= highA ? "improvement" : "worse"}`,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
            <div className="text-xl font-semibold">{kpi.value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ObsList title={`New in ${b}`} items={cmp.fresh} tone="var(--series-2)" />
        <ObsList title={`Resolved since ${a} (no longer reported)`} items={cmp.resolved} tone="var(--status-good)" />
      </div>

      <section className="rounded-2xl border p-5" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <h2 className="text-sm font-semibold mb-3">
          Repeated observations ({cmp.repeats.length})
          {cmp.escalated.length > 0 && (
            <span className="ml-2 font-normal" style={{ color: "var(--status-critical)" }}>
              {cmp.escalated.length} escalated in severity
            </span>
          )}
        </h2>
        {cmp.repeats.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>No observation from {a} reappears in {b}.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {cmp.repeats.map((r) => (
              <li key={r.from.id} className="border-t pt-2 first:border-t-0 first:pt-0 flex items-start justify-between gap-3" style={{ borderColor: "var(--grid)" }}>
                <span>
                  <span className="font-medium">{r.to.title}</span>
                  <span style={{ color: "var(--muted)" }}> · repeated from {a}</span>
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <Pill risk={r.from.risk} /> <span style={{ color: "var(--muted)" }}>→</span> <Pill risk={r.to.risk} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
          Repeats are matched by text similarity between quarters. Ask the <Link href="/chat" className="underline">AI Assistant</Link> for a narrative comparison.
        </p>
      </section>
    </div>
  );
}
