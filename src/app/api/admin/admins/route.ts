import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/db/client";
import { admins } from "@/db/schema";
import { asc } from "drizzle-orm";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: admins.id,
      email: admins.email,
      name: admins.name,
      lastLoginAt: admins.lastLoginAt,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .orderBy(asc(admins.email));

  return NextResponse.json(rows);
}

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().trim().max(200).default(""),
  // Omitted -> a one-time password is generated and returned once.
  password: z.string().min(8).max(200).optional(),
});

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const generated = parsed.data.password ? null : randomBytes(9).toString("base64url");
  const password = parsed.data.password ?? generated!;

  const [row] = await db
    .insert(admins)
    .values({ email, name: parsed.data.name, passwordHash: hashPassword(password) })
    .onConflictDoNothing()
    .returning({ id: admins.id, email: admins.email });
  if (!row) return NextResponse.json({ error: "An admin with that email already exists" }, { status: 409 });

  await logAudit(admin.id, "create", "admin", row.id, { email });

  // The generated password is shown exactly once, to the creating admin.
  return NextResponse.json({ ...row, generatedPassword: generated }, { status: 201 });
}
