import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createAdminSession, verifyPassword } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const [admin] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);

  if (!admin || !verifyPassword(parsed.data.password, admin.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createAdminSession(admin.id, admin.email);
  await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id));
  await logAudit(admin.id, "login", "admin", admin.id);

  return NextResponse.json({ ok: true });
}
