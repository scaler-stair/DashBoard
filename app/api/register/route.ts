import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSql } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";

/** Public sign-up: creates a company (org) plus its first client_admin account and signs them in. */
export async function POST(req: NextRequest) {
  const { company, name, email, password } = (await req.json()) as {
    company?: string;
    name?: string;
    email?: string;
    password?: string;
  };

  if (!company?.trim() || !name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Company name, your name, and email are required" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  const slug = company.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) {
    return NextResponse.json({ error: "Company name must contain letters or numbers" }, { status: 400 });
  }
  const emailNorm = email.trim().toLowerCase();

  const sql = getSql();
  try {
    const result = await sql.begin(async (tx) => {
      const orgRows = await tx`
        INSERT INTO orgs (name, slug) VALUES (${company.trim()}, ${slug}) RETURNING id, name`;
      const org = orgRows[0] as { id: number; name: string };
      const userRows = await tx`
        INSERT INTO users (org_id, email, name, role, password_hash)
        VALUES (${org.id}, ${emailNorm}, ${name.trim()}, 'client_admin', ${bcrypt.hashSync(password, 10)})
        RETURNING id`;
      return { orgId: org.id, orgName: org.name, userId: (userRows[0] as { id: number }).id };
    });

    const token = await createSessionToken({
      userId: result.userId,
      orgId: result.orgId,
      role: "client_admin",
      name: name.trim(),
      email: emailNorm,
      orgName: result.orgName,
    });
    const res = NextResponse.json({ ok: true });
    res.cookies.set("session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });
    return res;
  } catch (err) {
    const e = err as { code?: string; constraint_name?: string; message?: string };
    if (e.code === "23505") {
      const constraint = e.constraint_name ?? "";
      if (constraint.startsWith("users")) {
        return NextResponse.json({ error: "An account with that email already exists. Sign in instead." }, { status: 409 });
      }
      return NextResponse.json({ error: "A company with that name already exists. Ask your admin for a login." }, { status: 409 });
    }
    console.error("Registration failed:", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
