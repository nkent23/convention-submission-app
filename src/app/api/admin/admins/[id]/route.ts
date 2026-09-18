import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { admins } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  name: z.string().trim().max(200).optional(),
  password: z.string().min(8).max(200).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Admins can rotate their own password; changing someone else's is also
  // allowed (small trusted team), and always audited.
  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.password) update.passwordHash = hashPassword(parsed.data.password);
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [row] = await db
    .update(admins)
    .set(update)
    .where(eq(admins.id, id))
    .returning({ id: admins.id, email: admins.email });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAudit(admin.id, "update", "admin", id, {
    passwordChanged: Boolean(parsed.data.password),
  });
  return NextResponse.json(row);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (id === admin.id) {
    return NextResponse.json({ error: "You cannot delete the account you are signed in as" }, { status: 400 });
  }

  const [{ n }] = await db.select({ n: count() }).from(admins);
  if (n <= 1) {
    return NextResponse.json({ error: "Cannot delete the last admin" }, { status: 400 });
  }

  const [row] = await db.delete(admins).where(eq(admins.id, id)).returning({ email: admins.email });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAudit(admin.id, "delete", "admin", id, { email: row.email });
  return NextResponse.json({ ok: true });
}
