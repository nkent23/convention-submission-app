import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { members, schools } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  schoolId: z.number().int().positive().optional(),
  submissionUrl: z.string().trim().url().max(2000).optional(),
  status: z.enum(["active", "archived"]).optional(),
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

  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.schoolId) {
    const [school] = await db
      .select()
      .from(schools)
      .where(eq(schools.id, parsed.data.schoolId))
      .limit(1);
    if (!school) return NextResponse.json({ error: "School not found" }, { status: 400 });
    update.organizationId = school.organizationId;
  }

  const [row] = await db.update(members).set(update).where(eq(members.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAudit(admin.id, "update", "member", id, parsed.data);
  return NextResponse.json(row);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [row] = await db.delete(members).where(eq(members.id, id)).returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAudit(admin.id, "delete", "member", id, { name: row.name });
  return NextResponse.json({ ok: true });
}
