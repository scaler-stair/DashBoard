"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/observations", label: "Observations" },
  { href: "/compare", label: "Compare Quarters" },
  { href: "/chat", label: "AI Assistant" },
  { href: "/reports", label: "Reports" },
  { href: "/admin", label: "Admin" },
];

export function Nav({
  userName,
  orgName,
  role,
  orgs,
  activeOrg,
}: {
  userName: string;
  orgName: string;
  role: string;
  orgs: Array<{ id: number; name: string }>;
  activeOrg: number | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const visible = LINKS.filter(
    (l) => l.href !== "/admin" || role === "super_admin" || role === "client_admin"
  );

  async function switchOrg(orgId: number) {
    await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    router.refresh();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <div className="mx-auto max-w-6xl px-4 flex items-center gap-6 h-14">
        <span className="font-semibold text-sm">{orgName}</span>
        <nav className="flex gap-1 text-sm flex-1">
          {visible.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 rounded-lg"
              style={
                pathname === l.href
                  ? { background: "var(--page)", color: "var(--ink)", fontWeight: 600 }
                  : { color: "var(--ink-2)" }
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {role === "super_admin" && orgs.length > 0 && (
          <select
            value={activeOrg ?? undefined}
            onChange={(e) => switchOrg(Number(e.target.value))}
            className="text-sm border rounded-lg px-2 py-1"
            style={{ borderColor: "var(--grid)", background: "var(--surface-1)" }}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
        <div className="text-sm" style={{ color: "var(--ink-2)" }}>{userName}</div>
        <button onClick={logout} className="text-sm underline" style={{ color: "var(--muted)" }}>
          Sign out
        </button>
      </div>
    </header>
  );
}
