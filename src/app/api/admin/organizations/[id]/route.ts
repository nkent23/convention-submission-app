import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({ name: z.string().trim().min(1).max(200) });

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [row] = await db
    .update(organizations)
    .set({ name: parsed.data.name })
    .where(eq(organizations.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAudit(admin.id, "update", "organization", id, { name: parsed.data.name });
  return NextResponse.json(row);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [row] = await db.delete(organizations).where(eq(organizations.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAudit(admin.id, "delete", "organization", id, { name: row.name });
  return NextResponse.json({ ok: true });
}
