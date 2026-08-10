"use client";

import { useRouter } from "next/navigation";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, LineChart, Line, Legend,
} from "recharts";

const RISK_COLORS: Record<string, string> = {
  High: "var(--status-critical)",
  Medium: "var(--status-warning)",
  Low: "var(--status-good)",
};

const tooltipStyle = {
  background: "var(--surface-1)",
  border: "1px solid var(--grid)",
  borderRadius: 8,
  fontSize: 13,
  color: "var(--ink)",
};

export function RiskDonut({ data }: { data: Array<{ name: string; value: number }> }) {
  const router = useRouter();
  const total = data.reduce((s, d) => s + d.value, 0);
  const goToRisk = (risk: string) => router.push(`/observations?risk=${encodeURIComponent(risk)}`);
  return (
    <div className="flex items-center gap-4">
      <div className="h-44 w-44 relative">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              stroke="var(--surface-1)"
              strokeWidth={2}
              cursor="pointer"
              onClick={(entry) => {
                const e = entry as { name?: string; payload?: { name?: string } };
                const name = e?.name ?? e?.payload?.name;
                if (name) goToRisk(String(name));
              }}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={RISK_COLORS[d.name] ?? "var(--series-1)"} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-semibold">{total}</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>total</div>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name}>
            <button className="flex items-center gap-2 hover:underline cursor-pointer" onClick={() => goToRisk(d.name)}>
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: RISK_COLORS[d.name] }} />
              <span style={{ color: "var(--ink-2)" }}>{d.name} risk</span>
              <span className="font-semibold">{d.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DeptBar({ data }: { data: Array<{ name: string; value: number }> }) {
  const router = useRouter();
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 10);
  return (
    <div style={{ height: Math.max(180, sorted.length * 34) }}>
      <ResponsiveContainer>
        <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 32 }}>
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--baseline)" />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "var(--ink-2)" }} stroke="var(--baseline)" />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--page)" }} />
          <Bar
            dataKey="value"
            name="Observations"
            fill="var(--series-1)"
            radius={[0, 4, 4, 0]}
            barSize={16}
            label={{ position: "right", fontSize: 12, fill: "var(--ink-2)" }}
            cursor="pointer"
            onClick={(entry) => {
              const e = entry as { name?: string; payload?: { name?: string } };
              const name = e?.name ?? e?.payload?.name;
              if (name) router.push(`/observations?dept=${encodeURIComponent(name)}`);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function QuarterTrend({ data }: { data: Array<{ quarter: string; total: number; open: number; closed: number }> }) {
  const router = useRouter();
  return (
    <div className="h-60">
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
          style={{ cursor: "pointer" }}
          onClick={(state) => {
            if (state?.activeLabel) router.push(`/observations?quarter=${encodeURIComponent(String(state.activeLabel))}`);
          }}
        >
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--baseline)" />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--baseline)" />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Line type="monotone" dataKey="total" name="Total" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="open" name="Open" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="closed" name="Closed" stroke="var(--series-3)" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
