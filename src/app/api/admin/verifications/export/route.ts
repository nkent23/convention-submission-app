import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { members, organizations, schools, verifications } from "@/db/schema";
import { and, count, desc, eq, ilike, max, SQL } from "drizzle-orm";
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
  const unique = sp.get("unique") === "1";

  const conditions: SQL[] = [];
  if (q) conditions.push(ilike(members.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`));
  if (Number.isInteger(orgId) && orgId > 0) conditions.push(eq(members.organizationId, orgId));
  const where = conditions.length ? and(...conditions) : undefined;

  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  if (unique) {
    // One row per member: latest verification plus how many times they verified.
    const lastVerifiedAt = max(verifications.verifiedAt);
    const rows = await db
      .select({
        verifiedAt: lastVerifiedAt,
        memberName: members.name,
        schoolName: schools.name,
        orgName: organizations.name,
        timesVerified: count(verifications.id),
      })
      .from(verifications)
      .innerJoin(members, eq(verifications.memberId, members.id))
      .innerJoin(schools, eq(members.schoolId, schools.id))
      .innerJoin(organizations, eq(members.organizationId, organizations.id))
      .where(where)
      .groupBy(members.id, members.name, schools.name, organizations.name)
      .orderBy(desc(lastVerifiedAt));

    lines.push("last_verified_at_central,member_name,school,organization,times_verified");
    for (const r of rows) {
      lines.push(
        [
          r.verifiedAt ? fmt.format(r.verifiedAt) : "",
          r.memberName,
          r.schoolName,
          r.orgName,
          String(r.timesVerified),
        ]
          .map(csvField)
          .join(","),
      );
    }
  } else {
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
      .where(where)
      .orderBy(desc(verifications.verifiedAt));

    lines.push("verified_at_central,member_name,school,organization");
    for (const r of rows) {
      lines.push(
        [fmt.format(r.verifiedAt), r.memberName, r.schoolName, r.orgName]
          .map(csvField)
          .join(","),
      );
    }
  }

  const filename = unique ? `verified-members-${today}.csv` : `verifications-${today}.csv`;
  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
