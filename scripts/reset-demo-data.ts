// One-off cleanup: removes the seeded demo orgs/users and all test reports,
// leaving only the platform super admin. Storage objects are removed too.
// Usage: npx tsx scripts/reset-demo-data.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", prepare: false, max: 1 });

  const files = (await sql`SELECT file_path FROM reports`) as unknown as Array<{ file_path: string }>;
  await sql`DELETE FROM chunks`;
  await sql`DELETE FROM observations`;
  await sql`DELETE FROM reports`;
  await sql`DELETE FROM users`;
  await sql`DELETE FROM orgs`;

  const hash = bcrypt.hashSync("stair123", 10);
  await sql`
    INSERT INTO users (org_id, email, name, role, password_hash)
    VALUES (${null}, ${"superadmin"}, ${"Super Admin"}, ${"super_admin"}, ${hash})`;

  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supaUrl && supaKey && files.length > 0) {
    const admin = createClient(supaUrl, supaKey, { auth: { persistSession: false } });
    const { error } = await admin.storage.from("reports").remove(files.map((f) => f.file_path));
    if (error) console.warn("Storage cleanup warning:", error.message);
  }

  console.log(`Cleaned ${files.length} stored PDFs, all demo orgs/users/reports.`);
  console.log("Remaining login: superadmin / stair123");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
