import { getSession, activeOrgId } from "@/lib/auth";
import { orgObservations, kpis, groupCount, quarterTrend } from "@/lib/stats";
import { RiskDonut, DeptBar, QuarterTrend } from "@/components/charts";
import Link from "next/link";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-5" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-2)" }}>{title}</h2>
      {children}
    </section>
  );
}

function Kpi({ label, value, tone, href }: { label: string; value: number; tone?: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border p-4 block hover:shadow-md transition-shadow"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <div className="text-2xl font-semibold" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{label}</div>
    </Link>
  );
}

export default async function ExecDashboard() {
  const session = (await getSession())!;
  const orgId = await activeOrgId(session);
  const rows = orgId ? await orgObservations(orgId) : [];

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border p-10 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <h1 className="text-lg font-semibold">No audit data yet</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>
          Upload your first quarterly internal audit PDF and the AI will extract every observation automatically.
        </p>
        <Link href="/admin" className="inline-block mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--accent)" }}>
          Go to Admin → Upload report
        </Link>
      </div>
    );
  }

  const k = kpis(rows);
  const byRisk = ["High", "Medium", "Low"]
    .map((r) => ({ name: r, value: rows.filter((o) => o.risk === r).length }))
    .filter((d) => d.value > 0);
  const byDept = groupCount(rows, (o) => o.department);
  const trend = quarterTrend(rows);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Executive Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Kpi label="Total observations" value={k.total} href="/observations" />
        <Kpi label="Open" value={k.open} tone="var(--status-critical)" href="/observations?status=Open" />
        <Kpi label="In progress" value={k.inProgress} tone="var(--status-warning)" href="/observations?status=In Progress" />
        <Kpi label="Closed" value={k.closed} tone="var(--status-good)" href="/observations?status=Closed" />
        <Kpi label="High risk" value={k.high} tone="var(--status-critical)" href="/observations?risk=High" />
        <Kpi label="Medium risk" value={k.medium} href="/observations?risk=Medium" />
        <Kpi label="Departments" value={k.departments} href="/observations" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Risk distribution">
          <RiskDonut data={byRisk} />
        </Card>
        <Card title="Observations by quarter">
          <QuarterTrend data={trend} />
        </Card>
      </div>
      <Card title="Observations by department">
        <DeptBar data={byDept} />
      </Card>
    </div>
  );
}
