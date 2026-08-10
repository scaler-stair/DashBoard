import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSql } from "@/lib/db";
import { createSessionToken, Session } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  const sql = getSql();
  const rows = await sql`
    SELECT u.id, u.org_id, u.email, u.name, u.role, u.password_hash, o.name AS org_name
    FROM users u LEFT JOIN orgs o ON o.id = u.org_id
    WHERE u.email = ${String(email).trim().toLowerCase()}`;
  const user = rows[0] as
    | {
        id: number;
        org_id: number | null;
        email: string;
        name: string;
        role: Session["role"];
        password_hash: string;
        org_name: string | null;
      }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSessionToken({
    userId: user.id,
    orgId: user.org_id,
    role: user.role,
    name: user.name,
    email: user.email,
    orgName: user.org_name,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
  return res;
}
