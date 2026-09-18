import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { members, schools } from "@/db/schema";
import { asc, count, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get("orgId");

  const base = db
    .select({
      id: schools.id,
      name: schools.name,
      organizationId: schools.organizationId,
      memberCount: count(members.id),
    })
    .from(schools)
    .leftJoin(members, eq(members.schoolId, schools.id))
    .groupBy(schools.id)
    .orderBy(asc(schools.name));

  const rows = orgId
    ? await base.where(eq(schools.organizationId, Number(orgId)))
    : await base;

  return NextResponse.json(rows);
}

const bodySchema = z.object({
  name: z.string().trim().min(1).max(300),
  organizationId: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Name and organizationId are required" }, { status: 400 });
  }

  const [row] = await db
    .insert(schools)
    .values(parsed.data)
    .onConflictDoNothing()
    .returning();
  if (!row) return NextResponse.json({ error: "School already exists in this organization" }, { status: 409 });

  await logAudit(admin.id, "create", "school", row.id, { name: row.name });
  return NextResponse.json(row, { status: 201 });
}
