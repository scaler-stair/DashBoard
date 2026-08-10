"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: number; email: string; name: string; role: string };

const card = { background: "var(--surface-1)", borderColor: "var(--border)" } as const;
const field = { borderColor: "var(--grid)", background: "var(--surface-1)" } as const;

export function AdminPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const router = useRouter();

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [quarter, setQuarter] = useState("Q1");
  const [fiscalYear, setFiscalYear] = useState("FY26");
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploading, setUploading] = useState(false);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ email: "", name: "", role: "viewer", password: "" });
  const [userMsg, setUserMsg] = useState("");

  // New org (super admin)
  const [orgName, setOrgName] = useState("");
  const [orgMsg, setOrgMsg] = useState("");

  useEffect(() => {
    fetch("/api/users").then(async (r) => {
      if (r.ok) setUsers((await r.json()).users);
    });
  }, []);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadMsg("Uploading and running AI extraction. This can take a minute for long reports…");
    const form = new FormData();
    form.append("file", file);
    form.append("quarter", quarter);
    form.append("fiscal_year", fiscalYear);
    const res = await fetch("/api/reports", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (res.ok) {
      setUploadMsg(`Done. ${data.observations} observations extracted from ${quarter} ${fiscalYear}.`);
      setFile(null);
      router.refresh();
    } else {
      setUploadMsg(data.error ?? "Upload failed");
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setUserMsg("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setUserMsg(`Login created for ${newUser.email}.`);
      setNewUser({ email: "", name: "", role: "viewer", password: "" });
      const r = await fetch("/api/users");
      if (r.ok) setUsers((await r.json()).users);
    } else {
      setUserMsg(data.error ?? "Failed to create user");
    }
  }

  async function addOrg(e: React.FormEvent) {
    e.preventDefault();
    setOrgMsg("");
    const res = await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: orgName }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setOrgMsg(`Organization "${orgName}" created. Switch to it from the top-right selector.`);
      setOrgName("");
      router.refresh();
    } else {
      setOrgMsg(data.error ?? "Failed to create organization");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Admin</h1>

      <section className="rounded-2xl border p-5" style={card}>
        <h2 className="text-sm font-semibold mb-3">Upload quarterly audit report (PDF)</h2>
        <form onSubmit={upload} className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Quarter</label>
            <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="border rounded-lg px-2 py-2" style={field}>
              <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Fiscal year</label>
            <input value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} className="border rounded-lg px-3 py-2 w-24" style={field} />
          </div>
          <div className="flex-1 min-w-52">
            <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>PDF file</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="border rounded-lg px-3 py-1.5 w-full"
              style={field}
            />
          </div>
          <button type="submit" disabled={!file || uploading} className="rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {uploading ? "Processing…" : "Upload & Extract"}
          </button>
        </form>
        {uploadMsg && <p className="mt-3 text-sm" style={{ color: "var(--ink-2)" }}>{uploadMsg}</p>}
      </section>

      <section className="rounded-2xl border p-5" style={card}>
        <h2 className="text-sm font-semibold mb-3">Login IDs for this organization</h2>
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <th className="py-2">Email</th><th className="py-2">Name</th><th className="py-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t" style={{ borderColor: "var(--grid)" }}>
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.name}</td>
                <td className="py-2" style={{ color: "var(--ink-2)" }}>{u.role.replace("_", " ")}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-center" style={{ color: "var(--muted)" }}>No users yet for this organization.</td></tr>
            )}
          </tbody>
        </table>
        <form onSubmit={addUser} className="flex flex-wrap items-end gap-3 text-sm">
          <input placeholder="email@company" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="border rounded-lg px-3 py-2" style={field} />
          <input placeholder="Full name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="border rounded-lg px-3 py-2" style={field} />
          <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="border rounded-lg px-2 py-2" style={field}>
            <option value="client_admin">Client admin</option>
            <option value="audit_team">Audit team</option>
            <option value="cxo">Management / CXO</option>
            <option value="viewer">Read-only viewer</option>
          </select>
          <input placeholder="Password (min 6 chars)" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="border rounded-lg px-3 py-2" style={field} />
          <button type="submit" className="rounded-lg px-4 py-2 font-medium text-white" style={{ background: "var(--accent)" }}>Create login</button>
        </form>
        {userMsg && <p className="mt-3 text-sm" style={{ color: "var(--ink-2)" }}>{userMsg}</p>}
      </section>

      {isSuperAdmin && (
        <section className="rounded-2xl border p-5" style={card}>
          <h2 className="text-sm font-semibold mb-3">Create a new client organization</h2>
          <form onSubmit={addOrg} className="flex flex-wrap items-end gap-3 text-sm">
            <input placeholder="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="border rounded-lg px-3 py-2 min-w-64" style={field} />
            <button type="submit" disabled={!orgName.trim()} className="rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
              Create organization
            </button>
          </form>
          {orgMsg && <p className="mt-3 text-sm" style={{ color: "var(--ink-2)" }}>{orgMsg}</p>}
        </section>
      )}
    </div>
  );
}
