const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEN_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
const EMBED_DIMS = 768;

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to audit-dashboard/.env.local and restart the server."
    );
  }
  return key;
}

const RETRY_DELAYS_MS = [2000, 8000, 20000];

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  let lastError = "";
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const res = await fetch(`${API_BASE}/${path}?key=${apiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const text = await res.text();
    lastError = `Gemini API error ${res.status}: ${text.slice(0, 500)}`;
    // 503 = overloaded, 429 = rate limited; both are transient.
    if ((res.status === 503 || res.status === 429) && attempt < RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      continue;
    }
    break;
  }
  throw new Error(lastError);
}

export type ExtractedObservation = {
  title: string;
  description: string;
  department: string;
  risk: "High" | "Medium" | "Low";
  recommendation: string;
  management_response: string;
  status: "Open" | "In Progress" | "Closed";
  owner: string;
  due_date: string;
};

export type ExtractionResult = {
  summary: string;
  observations: ExtractedObservation[];
};

const EXTRACTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "STRING",
      description: "5-8 sentence executive summary of the report",
    },
    observations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Short title, max 12 words" },
          description: { type: "STRING", description: "What the auditor observed" },
          department: {
            type: "STRING",
            description: "Department or process area, e.g. Finance, HR, IT, Procurement",
          },
          risk: { type: "STRING", enum: ["High", "Medium", "Low"] },
          recommendation: { type: "STRING", description: "Recommended action" },
          management_response: {
            type: "STRING",
            description: "Management's response if stated, else empty string",
          },
          status: { type: "STRING", enum: ["Open", "In Progress", "Closed"] },
          owner: { type: "STRING", description: "Responsible owner if stated, else empty string" },
          due_date: { type: "STRING", description: "Target date if stated (YYYY-MM-DD), else empty string" },
        },
        required: ["title", "description", "department", "risk", "recommendation", "status"],
      },
    },
  },
  required: ["summary", "observations"],
};

export async function extractObservations(pdf: Buffer): Promise<ExtractionResult> {
  const prompt = `You are an internal audit analyst. Read this quarterly internal audit report and extract EVERY audit observation / finding / significant matter it contains. For each one capture the department or process it belongs to, its risk severity, the recommended action, management's response, and its current status. If severity is not explicit, judge it from the language and financial impact. If status is not explicit, use "Open". Also write an executive summary. Respond only with the JSON.`;
  const data = await post(`models/${GEN_MODEL}:generateContent`, {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: "application/pdf", data: pdf.toString("base64") } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: EXTRACTION_SCHEMA,
      temperature: 0.2,
    },
  });
  const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  const text = candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned no content for extraction.");
  const parsed = JSON.parse(text) as ExtractionResult;
  if (!Array.isArray(parsed.observations)) throw new Error("Extraction result missing observations array.");
  return parsed;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const data = await post(`models/${EMBED_MODEL}:batchEmbedContents`, {
    requests: texts.map((text) => ({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text: text.slice(0, 8000) }] },
      outputDimensionality: EMBED_DIMS,
    })),
  });
  const embeddings = data.embeddings as Array<{ values: number[] }> | undefined;
  if (!embeddings) throw new Error("Gemini returned no embeddings.");
  return embeddings.map((e) => e.values);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function chatAnswer(
  question: string,
  context: string,
  history: Array<{ role: "user" | "model"; text: string }>
): Promise<string> {
  const system = `You are the AI assistant of an Internal Audit Dashboard. Answer strictly from the audit data provided in the context below. Quote observation counts, statuses, risks, departments and quarters accurately from it. When numbers are asked for, compute them from the context and show the breakdown. If the answer is not in the context, say so plainly. Be concise and executive-friendly.

CONTEXT:
${context}`;
  const data = await post(`models/${GEN_MODEL}:generateContent`, {
    system_instruction: { parts: [{ text: system }] },
    contents: [
      ...history.slice(-10).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: "user", parts: [{ text: question }] },
    ],
    generationConfig: { temperature: 0.3 },
  });
  const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  const text = candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned no content for chat.");
  return text;
}
