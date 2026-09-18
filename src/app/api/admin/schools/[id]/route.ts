import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { schools } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  organizationId: z.number().int().positive().optional(),
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

  const [row] = await db.update(schools).set(parsed.data).where(eq(schools.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAudit(admin.id, "update", "school", id, parsed.data);
  return NextResponse.json(row);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [row] = await db.delete(schools).where(eq(schools.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAudit(admin.id, "delete", "school", id, { name: row.name });
  return NextResponse.json({ ok: true });
}
