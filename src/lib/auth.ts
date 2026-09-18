import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";

const SESSION_COOKIE = "portal_admin";
const WEEK = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(data: object) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp === "number" && data.exp < Date.now() / 1000) return null;
    return data as T;
  } catch {
    return null;
  }
}

// ── Password hashing (scrypt, no external deps) ─────────────────────────────

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ── Admin session ───────────────────────────────────────────────────────────

export type AdminSession = { adminId: number; email: string; exp: number };

export async function createAdminSession(adminId: number, email: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encode({ adminId, email, exp: Date.now() / 1000 + WEEK }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: WEEK,
  });
}

export async function destroyAdminSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  return decode<AdminSession>(jar.get(SESSION_COOKIE)?.value);
}

/** Session + live row check; returns null unless the admin still exists. */
export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) return null;
  const [admin] = await db.select().from(admins).where(eq(admins.id, session.adminId)).limit(1);
  return admin ?? null;
}
