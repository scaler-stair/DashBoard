"use client";

import { useRef, useState } from "react";

type Message = { role: "user" | "model"; text: string };

const SUGGESTIONS = [
  "How many observations are still open, and which departments do they belong to?",
  "What changed between the last two quarters?",
  "Show all high-risk observations that are not closed.",
  "Give me a 5-point executive summary for the board.",
  "Which department has the most findings?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setError("");
    setBusy(true);
    setInput("");
    const history = messages;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chat failed");
      setMessages((m) => [...m, { role: "model", text: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">AI Assistant</h1>
      <p className="text-sm" style={{ color: "var(--ink-2)" }}>
        Ask anything about your organization&apos;s audit reports. Answers are grounded in the uploaded quarterly PDFs.
      </p>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="text-left text-sm border rounded-xl px-3 py-2 hover:shadow-sm"
              style={{ background: "var(--surface-1)", borderColor: "var(--grid)", color: "var(--ink-2)" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {messages.map((m, i) => (
          <div key={i} className="flex" style={{ justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div
              className="rounded-2xl px-4 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap border"
              style={
                m.role === "user"
                  ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                  : { background: "var(--surface-1)", borderColor: "var(--grid)" }
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm" style={{ color: "var(--muted)" }}>Thinking…</div>}
        {error && <div className="text-sm" style={{ color: "var(--status-critical)" }}>{error}</div>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
        className="flex gap-2 sticky bottom-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Which observations has my team not fixed yet?"
          className="flex-1 rounded-xl border px-4 py-2.5 text-sm shadow-sm outline-none"
          style={{ background: "var(--surface-1)", borderColor: "var(--grid)" }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl px-5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          Ask
        </button>
      </form>
    </div>
  );
}
