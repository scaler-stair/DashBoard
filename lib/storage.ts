import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const REPORTS_BUCKET = "reports";

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Copy them from Supabase → Project Settings → API into .env.local / Vercel env vars."
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export async function uploadPdf(pathKey: string, buffer: Buffer): Promise<void> {
  const { error } = await supabaseAdmin()
    .storage.from(REPORTS_BUCKET)
    .upload(pathKey, buffer, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function signedPdfUrl(pathKey: string): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .storage.from(REPORTS_BUCKET)
    .createSignedUrl(pathKey, 3600);
  if (error || !data?.signedUrl) throw new Error(`Could not sign URL: ${error?.message}`);
  return data.signedUrl;
}

export async function deletePdf(pathKey: string): Promise<void> {
  await supabaseAdmin().storage.from(REPORTS_BUCKET).remove([pathKey]);
}

/** Idempotent: creates the private reports bucket if it does not exist yet. */
export async function ensureBucket(): Promise<void> {
  const admin = supabaseAdmin();
  const { data } = await admin.storage.getBucket(REPORTS_BUCKET);
  if (!data) {
    const { error } = await admin.storage.createBucket(REPORTS_BUCKET, { public: false });
    if (error && !error.message.includes("already exists")) {
      throw new Error(`Could not create storage bucket: ${error.message}`);
    }
  }
}
