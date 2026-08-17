// One-time setup: applies the schema, creates the storage bucket, seeds orgs + demo logins.
// Usage: npm run setup   (needs DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local)
import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_PASSWORD = "stair123";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing in .env.local");
  const sql = postgres(url, { ssl: "require", prepare: false, max: 1 });

  console.log("Applying schema…");
  await sql.file(path.join(process.cwd(), "supabase", "schema.sql"), { cache: false });

  console.log("Ensuring storage bucket…");
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supaUrl && supaKey) {
    const admin = createClient(supaUrl, supaKey, { auth: { persistSession: false } });
    const { data } = await admin.storage.getBucket("reports");
    if (!data) {
      const { error } = await admin.storage.createBucket("reports", { public: false });
      if (error && !error.message.includes("already exists")) throw error;
    }
    // Public bucket for company logos.
    const { data: logos } = await admin.storage.getBucket("logos");
    if (!logos) {
      const { error } = await admin.storage.createBucket("logos", { public: true });
      if (error && !error.message.includes("already exists")) throw error;
    }
  } else {
    console.warn("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — skipped bucket creation.");
  }

  console.log("Seeding platform super admin…");
  const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
  await sql`
    INSERT INTO users (org_id, email, name, role, password_hash)
    VALUES (${null}, ${"superadmin"}, ${"Super Admin"}, ${"super_admin"}, ${hash})
    ON CONFLICT (email) DO NOTHING`;

  console.log(`Done. Login: superadmin / ${DEFAULT_PASSWORD} — change it before real client use.`);
  console.log("Companies are created from the Admin page after logging in as the super admin.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
