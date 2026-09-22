import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { members, organizations, schools, verifications } from "@/db/schema";
import { and, desc, eq, ilike, SQL } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

function csvField(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Central Time timestamps, matching what admins see in the app.
const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const orgId = Number(sp.get("orgId"));

  const conditions: SQL[] = [];
  if (q) conditions.push(ilike(members.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`));
  if (Number.isInteger(orgId) && orgId > 0) conditions.push(eq(members.organizationId, orgId));

  const rows = await db
    .select({
      verifiedAt: verifications.verifiedAt,
      memberName: members.name,
      schoolName: schools.name,
      orgName: organizations.name,
    })
    .from(verifications)
    .innerJoin(members, eq(verifications.memberId, members.id))
    .innerJoin(schools, eq(members.schoolId, schools.id))
    .innerJoin(organizations, eq(members.organizationId, organizations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(verifications.verifiedAt));

  const lines = ["verified_at_central,member_name,school,organization"];
  for (const r of rows) {
    lines.push(
      [fmt.format(r.verifiedAt), r.memberName, r.schoolName, r.orgName]
        .map(csvField)
        .join(","),
    );
  }

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="verifications-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
