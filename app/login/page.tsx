"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "signin" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const isRegister = mode === "register";
    const res = await fetch(isRegister ? "/api/register" : "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isRegister ? { company, name, email, password } : { email, password }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? (isRegister ? "Registration failed" : "Login failed"));
    }
  }

  const field = { borderColor: "var(--grid)" } as const;
  const label = { color: "var(--ink-2)" } as const;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border p-8 shadow-sm" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">Internal Audit AI Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {mode === "signin" ? "Sign in to your company dashboard" : "Register your company and its admin account"}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-lg border p-1 text-sm" style={{ borderColor: "var(--grid)" }}>
          {(["signin", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className="rounded-md py-1.5 font-medium"
              style={
                mode === m
                  ? { background: "var(--accent)", color: "#fff" }
                  : { color: "var(--ink-2)" }
              }
            >
              {m === "signin" ? "Sign in" : "Create company"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <>
              <div>
                <label className="block text-sm mb-1" style={label}>Company name</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={field}
                  placeholder="e.g. Gaja Capital"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={label}>Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={field}
                  placeholder="Admin full name"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm mb-1" style={label}>Email</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={field}
              placeholder="you@company"
              autoFocus={mode === "signin"}
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={label}>
              Password {mode === "register" && <span style={{ color: "var(--muted)" }}>(min 6 characters)</span>}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={field}
            />
          </div>
          {error && <p className="text-sm" style={{ color: "var(--status-critical)" }}>{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {busy
              ? mode === "signin" ? "Signing in…" : "Creating company…"
              : mode === "signin" ? "Sign in" : "Create company & continue"}
          </button>
        </form>

        {mode === "register" && (
          <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
            You become the company admin. Next: upload your quarterly audit PDF, then create logins for your team from the Admin page.
          </p>
        )}
      </div>
    </main>
  );
}
