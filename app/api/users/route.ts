import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSql } from "@/lib/db";
import { getSession, activeOrgId, canManageUsers } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const orgId = await activeOrgId(session);
  const sql = getSql();
  const users = await sql`
    SELECT id, email, name, role, to_char(created_at, 'YYYY-MM-DD') AS created_at
    FROM users WHERE org_id = ${orgId} ORDER BY id`;
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const orgId = await activeOrgId(session);
  if (!orgId) return NextResponse.json({ error: "No organization selected" }, { status: 400 });

  const { email, name, role, password } = (await req.json()) as {
    email?: string;
    name?: string;
    role?: string;
    password?: string;
  };
  if (!email?.trim() || !name?.trim() || !password || password.length < 6) {
    return NextResponse.json(
      { error: "Email, name, and a password of at least 6 characters are required" },
      { status: 400 }
    );
  }
  const allowedRoles = ["client_admin", "audit_team", "cxo", "viewer"];
  if (!role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const sql = getSql();
  try {
    await sql`
      INSERT INTO users (org_id, email, name, role, password_hash)
      VALUES (${orgId}, ${email.trim().toLowerCase()}, ${name.trim()}, ${role}, ${bcrypt.hashSync(password, 10)})`;
  } catch {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
