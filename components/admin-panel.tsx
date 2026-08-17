"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LOGO_ACCEPT, logoError } from "@/lib/logos";

type User = { id: number; email: string; name: string; role: string };

const card = { background: "var(--surface-1)", borderColor: "var(--border)" } as const;
const field = { borderColor: "var(--grid)", background: "var(--surface-1)" } as const;

function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const router = useRouter();

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [quarter, setQuarter] = useState("Q1");
  const [fiscalYear, setFiscalYear] = useState("FY26");
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ email: "", name: "", role: "viewer", password: "" });
  const [userMsg, setUserMsg] = useState("");

  // New org (super admin)
  const [orgName, setOrgName] = useState("");
  const [orgLogo, setOrgLogo] = useState<File | null>(null);
  const [orgLogoPreview, setOrgLogoPreview] = useState<string | null>(null);
  const [orgMsg, setOrgMsg] = useState("");
  const orgLogoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/users").then(async (r) => {
      if (r.ok) setUsers((await r.json()).users);
    });
  }, []);

  useEffect(() => {
    if (!orgLogo) {
      setOrgLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(orgLogo);
    setOrgLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [orgLogo]);

  function pickPdf(candidate: File | null | undefined) {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".pdf")) {
      setUploadMsg("Only PDF files can be processed.");
      return;
    }
    setUploadMsg("");
    setFile(candidate);
  }

  function pickOrgLogo(candidate: File | null) {
    if (!candidate) {
      setOrgLogo(null);
      return;
    }
    const bad = logoError(candidate);
    if (bad) {
      setOrgMsg(bad);
      return;
    }
    setOrgMsg("");
    setOrgLogo(candidate);
  }

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
    const form = new FormData();
    form.append("name", orgName);
    if (orgLogo) form.append("logo", orgLogo);
    const res = await fetch("/api/org", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setOrgMsg(
        data.logoWarning
          ? `Organization "${orgName}" created. ${data.logoWarning}`
          : `Organization "${orgName}" created${orgLogo ? " with its logo" : ""}. Switch to it from the top-right selector.`
      );
      setOrgName("");
      setOrgLogo(null);
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
        <form onSubmit={upload} className="space-y-4 text-sm">
          <div className="flex flex-wrap items-end gap-3">
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
          </div>

          <input
            ref={pdfInput}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => pickPdf(e.target.files?.[0])}
          />

          {file ? (
            <div
              className="flex items-center gap-3 rounded-xl border px-4 py-3"
              style={{ borderColor: "var(--accent)", background: "rgba(28, 92, 171, 0.05)" }}
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white"
                style={{ background: "var(--accent)" }}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" strokeLinejoin="round" />
                  <path d="M14 3v5h5" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>{fileSize(file.size)} · ready to extract</p>
              </div>
              <button
                type="button"
                onClick={() => pdfInput.current?.click()}
                disabled={uploading}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => setFile(null)}
                disabled={uploading}
                className="text-xs underline disabled:opacity-50"
                style={{ color: "var(--muted)" }}
              >
                Remove
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickPdf(e.dataTransfer.files?.[0]);
              }}
              onClick={() => pdfInput.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pdfInput.current?.click();
                }
              }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl px-6 py-9 text-center transition-colors"
              style={{
                border: `2px dashed ${dragging ? "var(--accent)" : "var(--baseline)"}`,
                background: dragging ? "rgba(28, 92, 171, 0.07)" : "var(--page)",
              }}
            >
              <span
                className="mb-3 grid h-12 w-12 place-items-center rounded-full text-white"
                style={{ background: "var(--accent)" }}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M12 16V4" strokeLinecap="round" />
                  <path d="M7.5 8.5L12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" strokeLinecap="round" />
                </svg>
              </span>
              <p className="text-base font-semibold">Drag and drop your audit report here</p>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
                or pick it from your computer
              </p>
              <span
                className="mt-4 inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
                style={{ background: "var(--accent)" }}
              >
                Browse files
              </span>
              <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>PDF only · one quarterly report at a time</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!file || uploading}
            className="rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
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
          <form onSubmit={addOrg} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>Organization name</label>
              <input placeholder="e.g. Protean eGov Technologies" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="border rounded-lg px-3 py-2 min-w-64" style={field} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--muted)" }}>
                Company logo (optional)
              </label>
              <div className="flex items-center gap-3">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border"
                  style={{ borderColor: "var(--grid)", background: "var(--page)" }}
                >
                  {orgLogoPreview ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */
                    <img src={orgLogoPreview} alt="Logo preview" className="h-full w-full object-contain" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="var(--muted)" strokeWidth="1.7">
                      <rect x="3" y="4" width="18" height="16" rx="3" />
                      <circle cx="9" cy="10" r="1.6" />
                      <path d="M4.5 18l4.8-4.8 3.2 3.2 2.6-2.4 4.4 4" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <input
                  ref={orgLogoInput}
                  type="file"
                  accept={LOGO_ACCEPT}
                  className="hidden"
                  onChange={(e) => pickOrgLogo(e.target.files?.[0] ?? null)}
                />
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => orgLogoInput.current?.click()}
                    className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                    style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                  >
                    {orgLogo ? "Change logo" : "Upload logo"}
                  </button>
                  <p className="mt-1 truncate text-xs" style={{ color: "var(--muted)" }}>
                    {orgLogo ? orgLogo.name : "PNG, JPG, SVG or WebP · up to 2 MB"}
                  </p>
                </div>
                {orgLogo && (
                  <button
                    type="button"
                    onClick={() => setOrgLogo(null)}
                    className="shrink-0 text-xs underline"
                    style={{ color: "var(--muted)" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
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
