import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getSql } from "./db";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-only-secret-change-in-production"
);

export type Session = {
  userId: number;
  orgId: number | null;
  role: "super_admin" | "client_admin" | "audit_team" | "cxo" | "viewer";
  name: string;
  email: string;
  orgName: string | null;
};

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get("session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/** The org whose data the current user sees. Super admins can switch via the activeOrg cookie. */
export async function activeOrgId(session: Session): Promise<number | null> {
  if (session.role !== "super_admin") return session.orgId;
  const sql = getSql();
  const store = await cookies();
  const raw = store.get("activeOrg")?.value;
  if (raw && /^\d+$/.test(raw)) {
    const rows = await sql`SELECT id FROM orgs WHERE id = ${Number(raw)}`;
    if (rows.length > 0) return rows[0].id as number;
  }
  const first = await sql`SELECT id FROM orgs ORDER BY id LIMIT 1`;
  return (first[0]?.id as number) ?? null;
}

export function canUpload(role: Session["role"]): boolean {
  return role === "super_admin" || role === "client_admin";
}

export function canManageUsers(role: Session["role"]): boolean {
  return role === "super_admin" || role === "client_admin";
}

export function canUpdateStatus(role: Session["role"]): boolean {
  return role === "super_admin" || role === "client_admin" || role === "audit_team";
}
