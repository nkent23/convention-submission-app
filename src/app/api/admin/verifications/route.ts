import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { members, organizations, schools, verifications } from "@/db/schema";
import { and, count, desc, eq, ilike, SQL } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const q = (sp.get("q") ?? "").trim();
  const orgId = Number(sp.get("orgId"));

  const conditions: SQL[] = [];
  if (q) conditions.push(ilike(members.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`));
  if (Number.isInteger(orgId) && orgId > 0) conditions.push(eq(members.organizationId, orgId));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: verifications.id,
        verifiedAt: verifications.verifiedAt,
        memberName: members.name,
        schoolName: schools.name,
        orgName: organizations.name,
      })
      .from(verifications)
      .innerJoin(members, eq(verifications.memberId, members.id))
      .innerJoin(schools, eq(members.schoolId, schools.id))
      .innerJoin(organizations, eq(members.organizationId, organizations.id))
      .where(where)
      .orderBy(desc(verifications.verifiedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(verifications)
      .innerJoin(members, eq(verifications.memberId, members.id))
      .where(where),
  ]);

  return NextResponse.json({ rows, total, page, pageSize: PAGE_SIZE });
}
