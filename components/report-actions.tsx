"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteReportButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Delete this report and all its extracted observations?")) return;
    setBusy(true);
    await fetch(`/api/reports/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button onClick={remove} disabled={busy} className="underline disabled:opacity-50" style={{ color: "var(--status-critical)" }}>
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
