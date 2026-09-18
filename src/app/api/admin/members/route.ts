import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { members, organizations, schools } from "@/db/schema";
import { and, asc, count, eq, ilike, SQL } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const q = (sp.get("q") ?? "").trim();
  const schoolId = Number(sp.get("schoolId"));
  const orgId = Number(sp.get("orgId"));
  const status = sp.get("status");

  const conditions: SQL[] = [];
  if (q) conditions.push(ilike(members.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`));
  if (Number.isInteger(schoolId) && schoolId > 0) conditions.push(eq(members.schoolId, schoolId));
  if (Number.isInteger(orgId) && orgId > 0) conditions.push(eq(members.organizationId, orgId));
  if (status === "active" || status === "archived") {
    conditions.push(eq(members.status, status));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: members.id,
        name: members.name,
        submissionUrl: members.submissionUrl,
        status: members.status,
        schoolId: members.schoolId,
        organizationId: members.organizationId,
        schoolName: schools.name,
        orgName: organizations.name,
      })
      .from(members)
      .innerJoin(schools, eq(members.schoolId, schools.id))
      .innerJoin(organizations, eq(members.organizationId, organizations.id))
      .where(where)
      .orderBy(asc(members.name))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(members).where(where),
  ]);

  return NextResponse.json({ rows, total, page, pageSize: PAGE_SIZE });
}

const bodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  schoolId: z.number().int().positive(),
  submissionUrl: z.string().trim().url().max(2000),
  status: z.enum(["active", "archived"]).default("active"),
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

  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, parsed.data.schoolId))
    .limit(1);
  if (!school) return NextResponse.json({ error: "School not found" }, { status: 400 });

  const [row] = await db
    .insert(members)
    .values({ ...parsed.data, organizationId: school.organizationId })
    .returning();

  await logAudit(admin.id, "create", "member", row.id, { name: row.name });
  return NextResponse.json(row, { status: 201 });
}
