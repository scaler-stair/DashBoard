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

const RETRY_DELAYS_MS = [2000, 8000, 20000, 45000, 90000];
const MAX_RETRY_WAIT_MS = 120000;

/** Quota errors carry their own "Please retry in 37.06s" hint; obey it. */
function retryAfterMs(body: string): number | null {
  const seconds = body.match(/retry in ([\d.]+)s/i);
  if (!seconds) return null;
  const ms = Math.ceil(Number(seconds[1]) * 1000) + 1000;
  return Number.isFinite(ms) ? Math.min(ms, MAX_RETRY_WAIT_MS) : null;
}

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  let lastError = "";
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/${path}?key=${apiKey()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // Dropped connections happen on long uploads; treat them like a 503.
      lastError = `Gemini request failed: ${err instanceof Error ? err.message : String(err)}`;
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      break;
    }
    if (res.ok) return res.json();
    const text = await res.text();
    lastError = `Gemini API error ${res.status}: ${text.slice(0, 500)}`;
    // 503 = overloaded, 429 = rate limited / over quota; both are transient.
    if ((res.status === 503 || res.status === 429) && attempt < RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, retryAfterMs(text) ?? RETRY_DELAYS_MS[attempt]));
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
  /** 1-based page of the PDF the finding was read from. 0 when unknown. */
  source_page: number;
  /** Sentences copied verbatim from that page, used to highlight the source. */
  source_quote: string;
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
          source_page: {
            type: "INTEGER",
            description:
              "1-based page number of THIS PDF file (count the pages of the file itself, ignore any page numbers printed on the page) where the observation is written. 0 if you cannot tell.",
          },
          source_quote: {
            type: "STRING",
            description:
              "The passage on that page the observation was taken from, copied EXACTLY character for character from the document: same words, numbers, punctuation and casing, no paraphrasing, no ellipses, no added text. 1-3 consecutive sentences (or the full table row / bullet), 40-400 characters.",
          },
        },
        required: ["title", "description", "department", "risk", "recommendation", "status", "source_page", "source_quote"],
      },
    },
  },
  required: ["summary", "observations"],
};

export async function extractObservations(pdf: Buffer): Promise<ExtractionResult> {
  const prompt = `You are an internal audit analyst. Read this quarterly internal audit report and extract EVERY audit observation / finding / significant matter it contains. For each one capture the department or process it belongs to, its risk severity, the recommended action, management's response, and its current status. If severity is not explicit, judge it from the language and financial impact. If status is not explicit, use "Open".

For every observation you must also cite where it came from: source_page is the page of this PDF file it appears on (count pages of the file from 1, ignore printed page labels), and source_quote is the exact text on that page the observation is based on, copied verbatim from the document. The quote is used to highlight the passage inside the original PDF, so it must match the document character for character. Never invent, translate, summarise or reflow a quote; if a finding is spread over a table, quote the row that carries the number you cited.

Also write an executive summary. Respond only with the JSON.`;
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

export type LocatedSource = { index: number; source_page: number; source_quote: string };

const LOCATE_SCHEMA = {
  type: "OBJECT",
  properties: {
    sources: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          index: { type: "INTEGER", description: "The index number of the observation, as given in the list" },
          source_page: { type: "INTEGER", description: "1-based page of THIS PDF file where it appears, 0 if not found" },
          source_quote: { type: "STRING", description: "Verbatim passage from that page, copied character for character" },
        },
        required: ["index", "source_page", "source_quote"],
      },
    },
  },
  required: ["sources"],
};

/**
 * Finds where already-extracted observations came from inside their report.
 * Used to backfill citations for observations extracted before this feature.
 */
export async function locateObservations(
  pdf: Buffer,
  observations: Array<{ index: number; title: string; description: string }>
): Promise<LocatedSource[]> {
  const list = observations
    .map((o) => `${o.index}. ${o.title}${o.description ? ` — ${o.description}` : ""}`)
    .join("\n");
  const prompt = `This PDF is an internal audit report. Below is a numbered list of observations that were previously extracted from it. For each one, find the passage in the PDF it was taken from.

Return, for every index in the list: source_page (the page of this PDF file, counting the file's pages from 1 and ignoring any page numbers printed on the page) and source_quote (the text on that page the observation came from, copied EXACTLY from the document, character for character: same words, numbers, punctuation and casing, no paraphrasing and no ellipses, 1-3 consecutive sentences or the full table row, 40-400 characters).

The quote is used to highlight the passage inside the original PDF, so a quote that is not literally present in the document is worse than none: if you cannot find the passage, return source_page 0 and an empty source_quote.

OBSERVATIONS:
${list}

Respond only with the JSON.`;
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
      response_schema: LOCATE_SCHEMA,
      temperature: 0,
    },
  });
  const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  const text = candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned no content for source lookup.");
  const parsed = JSON.parse(text) as { sources?: LocatedSource[] };
  return Array.isArray(parsed.sources) ? parsed.sources : [];
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
