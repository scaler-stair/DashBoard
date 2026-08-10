import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

export function getSql() {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Paste your Supabase connection string (Project Settings → Database, use the pooled 'Transaction' string) into .env.local / Vercel env vars."
    );
  }
  // prepare:false is required for Supabase's transaction-mode pooler (pgbouncer).
  sql = postgres(url, { ssl: "require", prepare: false, max: 5 });
  return sql;
}

/** Format a pgvector literal from a number array. */
export function vectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
