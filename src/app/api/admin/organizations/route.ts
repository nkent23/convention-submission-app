import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { members, organizations, schools } from "@/db/schema";
import { asc, count, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      createdAt: organizations.createdAt,
      schoolCount: count(schools.id),
    })
    .from(organizations)
    .leftJoin(schools, eq(schools.organizationId, organizations.id))
    .groupBy(organizations.id)
    .orderBy(asc(organizations.name));

  const memberCounts = await db
    .select({ organizationId: members.organizationId, n: count(members.id) })
    .from(members)
    .groupBy(members.organizationId);
  const byOrg = new Map(memberCounts.map((r) => [r.organizationId, r.n]));

  return NextResponse.json(rows.map((r) => ({ ...r, memberCount: byOrg.get(r.id) ?? 0 })));
}

const bodySchema = z.object({ name: z.string().trim().min(1).max(200) });

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const [row] = await db
    .insert(organizations)
    .values({ name: parsed.data.name })
    .onConflictDoNothing()
    .returning();
  if (!row) return NextResponse.json({ error: "Organization already exists" }, { status: 409 });

  await logAudit(admin.id, "create", "organization", row.id, { name: row.name });
  return NextResponse.json(row, { status: 201 });
}
