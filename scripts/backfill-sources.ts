// Fills source_quote / source_page for observations extracted before citations
// existed, by asking Gemini to find each finding's passage in its own report.
//
// Usage:
//   npm run backfill-sources            # every observation still missing a quote
//   npm run backfill-sources -- 3 13    # only these report ids
//   npm run backfill-sources -- --all   # redo every observation, including cited ones
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { downloadPdf } from "../lib/storage";
import { locateObservations } from "../lib/ai";
import { findQuote, normalizeText, type PageText } from "../lib/pdf-match";

type ObsRow = { id: number; title: string; description: string | null };

async function pageTexts(pdf: Buffer): Promise<PageText[]> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
    getDocument: (opts: unknown) => { promise: Promise<PdfDoc> };
  };
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
  const pages: PageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const raw = content.items.map((it) => (it.str ?? "") + (it.hasEOL ? " " : "")).join("");
    pages.push({ pageNumber: i, text: normalizeText(raw) });
  }
  return pages;
}

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }>;
  }>;
};

async function main() {
  const args = process.argv.slice(2);
  const redoAll = args.includes("--all");
  const onlyReports = args.filter((a) => /^\d+$/.test(a)).map(Number);

  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", prepare: false, max: 1 });

  const reports = (await sql`
    SELECT r.id, r.title, r.quarter, r.fiscal_year, r.file_path
    FROM reports r
    WHERE r.status = 'ready'
      AND (${onlyReports.length === 0} OR r.id = ANY(${onlyReports}))
      AND EXISTS (
        SELECT 1 FROM observations o
        WHERE o.report_id = r.id AND (${redoAll} OR coalesce(o.source_quote, '') = '')
      )
    ORDER BY r.id`) as unknown as Array<{
    id: number; title: string; quarter: string; fiscal_year: string; file_path: string;
  }>;

  if (reports.length === 0) {
    console.log("Nothing to do: every observation already cites its source.");
    await sql.end();
    return;
  }
  console.log(`${reports.length} report(s) to process.\n`);

  let cited = 0;
  let skipped = 0;

  const failed: number[] = [];

  async function processReport(report: { id: number; title: string; quarter: string; fiscal_year: string; file_path: string }) {
    const observations = (await sql`
      SELECT id, title, description FROM observations
      WHERE report_id = ${report.id} AND (${redoAll} OR coalesce(source_quote, '') = '')
      ORDER BY id`) as unknown as ObsRow[];
    if (observations.length === 0) return;

    console.log(`Report ${report.id} — ${report.quarter} ${report.fiscal_year} "${report.title}" (${observations.length} observations)`);
    let pdf: Buffer;
    try {
      pdf = await downloadPdf(report.file_path);
    } catch (err) {
      console.log(`  skipped: ${(err as Error).message}\n`);
      skipped += observations.length;
      return;
    }

    const pages = await pageTexts(pdf);
    let located;
    try {
      located = await locateObservations(
        pdf,
        observations.map((o, i) => ({ index: i + 1, title: o.title, description: o.description ?? "" }))
      );
    } catch (err) {
      console.log(`  skipped: ${(err as Error).message}\n`);
      skipped += observations.length;
      return;
    }

    for (const source of located) {
      const observation = observations[source.index - 1];
      if (!observation) continue;
      const quote = (source.source_quote ?? "").trim();
      if (quote.length < 25) {
        console.log(`  #${observation.id} no quote returned — left for the viewer's text search`);
        skipped++;
        continue;
      }
      // Trust the text of the PDF over the model's page number.
      const match = findQuote(pages, quote, source.source_page || null);
      const page = match ? match.pageNumber : source.source_page || null;
      await sql`
        UPDATE observations SET source_quote = ${quote}, source_page = ${page}
        WHERE id = ${observation.id}`;
      const verdict = match ? `${match.kind} match, page ${page}` : "quote not found in text layer";
      console.log(`  #${observation.id} ${observation.title.slice(0, 52)} — ${verdict}`);
      cited++;
    }
    console.log("");
  }

  for (const [position, report] of reports.entries()) {
    // Space the calls out: the Gemini free tier allows only a few per minute.
    if (position > 0) await new Promise((r) => setTimeout(r, 4000));
    try {
      await processReport(report);
    } catch (err) {
      failed.push(report.id);
      console.log(`  report ${report.id} failed: ${(err as Error).message.slice(0, 200)}\n`);
    }
  }

  console.log(`Done. ${cited} observation(s) now cite a passage, ${skipped} left without one.`);
  if (failed.length > 0) {
    console.log(`Reports that need another run: ${failed.join(" ")}`);
    console.log(`  npm run backfill-sources -- ${failed.join(" ")}`);
  }
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
