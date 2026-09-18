import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { members, organizations, schools } from "@/db/schema";
import { and, asc, eq, ilike, SQL } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

function csvField(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Same filters as the members list, streamed out as CSV in the import format.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
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

  const rows = await db
    .select({
      org: organizations.name,
      school: schools.name,
      name: members.name,
      url: members.submissionUrl,
      status: members.status,
    })
    .from(members)
    .innerJoin(schools, eq(members.schoolId, schools.id))
    .innerJoin(organizations, eq(members.organizationId, organizations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(organizations.name), asc(schools.name), asc(members.name));

  const lines = ["organization,school,member_name,submission_url,status"];
  for (const r of rows) {
    lines.push(
      [r.org, r.school, r.name, r.url, r.status].map(csvField).join(","),
    );
  }

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="members-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
