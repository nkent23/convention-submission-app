import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { members, organizations, schools } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseRosterCsv, RosterRow } from "@/lib/csv";

const MAX_CSV_BYTES = 10 * 1024 * 1024;
const INSERT_CHUNK = 500;

const bodySchema = z.object({
  csv: z.string().min(1),
  mode: z.enum(["preview", "commit"]),
  duplicateHandling: z.enum(["skip", "update"]).default("skip"),
  // Archive active members of the CSV's organizations that are absent from
  // the file — the "replace roster for a new cycle" switch.
  archiveMissing: z.boolean().default(false),
  // Applied to rows without a submission_url; required when the CSV has no
  // submission_url column (everyone shares the convention portal URL).
  defaultSubmissionUrl: z.string().trim().url().max(2000).or(z.literal("")).default(""),
});

type Plan = {
  orgsToCreate: string[];
  schoolsToCreate: { org: string; school: string }[];
  toInsert: (RosterRow & { schoolKey: string })[];
  toUpdate: { id: number; submissionUrl: string; name: string }[];
  toSkip: number;
  toReactivate: number[];
  toArchive: { id: number; name: string }[];
  duplicateRowsInFile: number;
  errors: { line: number; message: string }[];
};

async function buildPlan(
  rows: RosterRow[],
  errors: { line: number; message: string }[],
  duplicateHandling: "skip" | "update",
  archiveMissing: boolean,
): Promise<Plan> {
  // Dedupe identical (org, school, name) rows within the file — last one wins.
  const seen = new Map<string, RosterRow>();
  for (const row of rows) {
    seen.set(`${row.organization}|${row.school}|${row.memberName}`.toLowerCase(), row);
  }
  const uniqueRows = [...seen.values()];
  const duplicateRowsInFile = rows.length - uniqueRows.length;

  const orgNames = [...new Set(uniqueRows.map((r) => r.organization))];
  const existingOrgs = orgNames.length
    ? await db.select().from(organizations).where(inArray(organizations.name, orgNames))
    : [];
  const orgIdByName = new Map(existingOrgs.map((o) => [o.name, o.id]));
  const orgsToCreate = orgNames.filter((n) => !orgIdByName.has(n));

  const schoolKeys = [...new Set(uniqueRows.map((r) => `${r.organization}|${r.school}`))];
  const existingOrgIds = existingOrgs.map((o) => o.id);
  const existingSchools = existingOrgIds.length
    ? await db.select().from(schools).where(inArray(schools.organizationId, existingOrgIds))
    : [];
  const schoolIdByKey = new Map<string, number>();
  const orgNameById = new Map(existingOrgs.map((o) => [o.id, o.name]));
  for (const s of existingSchools) {
    const orgName = orgNameById.get(s.organizationId);
    if (orgName) schoolIdByKey.set(`${orgName}|${s.name}`, s.id);
  }
  const schoolsToCreate = schoolKeys
    .filter((k) => !schoolIdByKey.has(k))
    .map((k) => {
      const [org, school] = k.split("|");
      return { org, school };
    });

  // All existing members of the file's organizations, one query per org set.
  const existingMembers = existingOrgIds.length
    ? await db.select().from(members).where(inArray(members.organizationId, existingOrgIds))
    : [];
  const schoolNameById = new Map(existingSchools.map((s) => [s.id, s.name]));
  const memberByKey = new Map<string, (typeof existingMembers)[number]>();
  for (const m of existingMembers) {
    const orgName = orgNameById.get(m.organizationId);
    const schoolName = schoolNameById.get(m.schoolId);
    if (orgName && schoolName) {
      memberByKey.set(`${orgName}|${schoolName}|${m.name}`.toLowerCase(), m);
    }
  }

  const toInsert: Plan["toInsert"] = [];
  const toUpdate: Plan["toUpdate"] = [];
  const toReactivate: number[] = [];
  let toSkip = 0;
  const matchedIds = new Set<number>();

  for (const row of uniqueRows) {
    const key = `${row.organization}|${row.school}|${row.memberName}`.toLowerCase();
    const existing = memberByKey.get(key);
    if (existing) {
      matchedIds.add(existing.id);
      const urlChanged = existing.submissionUrl !== row.submissionUrl;
      if (existing.status === "archived") toReactivate.push(existing.id);
      if (duplicateHandling === "update" && urlChanged) {
        toUpdate.push({ id: existing.id, submissionUrl: row.submissionUrl, name: row.memberName });
      } else {
        toSkip++;
      }
    } else {
      toInsert.push({ ...row, schoolKey: `${row.organization}|${row.school}` });
    }
  }

  const toArchive = archiveMissing
    ? existingMembers
        .filter((m) => m.status === "active" && !matchedIds.has(m.id))
        .map((m) => ({ id: m.id, name: m.name }))
    : [];

  return {
    orgsToCreate,
    schoolsToCreate,
    toInsert,
    toUpdate,
    toSkip,
    toReactivate,
    toArchive,
    duplicateRowsInFile,
    errors,
  };
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { csv, mode, duplicateHandling, archiveMissing, defaultSubmissionUrl } = parsed.data;
  if (csv.length > MAX_CSV_BYTES) {
    return NextResponse.json({ error: "CSV is larger than 10MB" }, { status: 413 });
  }

  const parsedCsv = parseRosterCsv(csv, defaultSubmissionUrl);
  if ("headerError" in parsedCsv) {
    return NextResponse.json({ error: parsedCsv.headerError }, { status: 400 });
  }

  const plan = await buildPlan(parsedCsv.rows, parsedCsv.errors, duplicateHandling, archiveMissing);

  if (mode === "preview") {
    return NextResponse.json({
      stats: {
        rowsInFile: parsedCsv.rows.length + parsedCsv.errors.length,
        validRows: parsedCsv.rows.length,
        duplicateRowsInFile: plan.duplicateRowsInFile,
        organizationsToCreate: plan.orgsToCreate,
        schoolsToCreate: plan.schoolsToCreate.length,
        membersToCreate: plan.toInsert.length,
        membersToUpdate: plan.toUpdate.length,
        membersToSkip: plan.toSkip,
        membersToReactivate: plan.toReactivate.length,
        membersToArchive: plan.toArchive.length,
      },
      errors: plan.errors.slice(0, 100),
      sampleCreates: plan.toInsert.slice(0, 10).map((r) => ({
        organization: r.organization,
        school: r.school,
        name: r.memberName,
      })),
      sampleArchives: plan.toArchive.slice(0, 10).map((m) => m.name),
    });
  }

  // ── Commit ────────────────────────────────────────────────────────────────

  const orgIdByName = new Map<string, number>();
  const allOrgNames = [...new Set([...plan.orgsToCreate, ...plan.toInsert.map((r) => r.organization)])];
  if (plan.orgsToCreate.length > 0) {
    await db
      .insert(organizations)
      .values(plan.orgsToCreate.map((name) => ({ name })))
      .onConflictDoNothing();
  }
  if (allOrgNames.length > 0) {
    const orgs = await db.select().from(organizations).where(inArray(organizations.name, allOrgNames));
    for (const o of orgs) orgIdByName.set(o.name, o.id);
  }

  const schoolIdByKey = new Map<string, number>();
  if (plan.schoolsToCreate.length > 0) {
    await db
      .insert(schools)
      .values(
        plan.schoolsToCreate.map(({ org, school }) => ({
          name: school,
          organizationId: orgIdByName.get(org)!,
        })),
      )
      .onConflictDoNothing();
  }
  const neededSchoolKeys = [...new Set(plan.toInsert.map((r) => r.schoolKey))];
  const neededOrgIds = [...new Set(neededSchoolKeys.map((k) => orgIdByName.get(k.split("|")[0])!))];
  if (neededOrgIds.length > 0) {
    const schoolRows = await db.select().from(schools).where(inArray(schools.organizationId, neededOrgIds));
    const orgNameById = new Map([...orgIdByName].map(([name, id]) => [id, name]));
    for (const s of schoolRows) {
      schoolIdByKey.set(`${orgNameById.get(s.organizationId)}|${s.name}`, s.id);
    }
  }

  let inserted = 0;
  for (let i = 0; i < plan.toInsert.length; i += INSERT_CHUNK) {
    const chunk = plan.toInsert.slice(i, i + INSERT_CHUNK).map((r) => ({
      name: r.memberName,
      schoolId: schoolIdByKey.get(r.schoolKey)!,
      organizationId: orgIdByName.get(r.organization)!,
      submissionUrl: r.submissionUrl,
      status: "active" as const,
    }));
    const result = await db.insert(members).values(chunk).returning({ id: members.id });
    inserted += result.length;
  }

  for (const upd of plan.toUpdate) {
    await db.update(members).set({ submissionUrl: upd.submissionUrl }).where(eq(members.id, upd.id));
  }

  if (plan.toReactivate.length > 0) {
    await db
      .update(members)
      .set({ status: "active" })
      .where(inArray(members.id, plan.toReactivate));
  }

  if (plan.toArchive.length > 0) {
    const ids = plan.toArchive.map((m) => m.id);
    await db
      .update(members)
      .set({ status: "archived" })
      .where(and(inArray(members.id, ids), eq(members.status, "active")));
  }

  const stats = {
    organizationsCreated: plan.orgsToCreate.length,
    schoolsCreated: plan.schoolsToCreate.length,
    membersCreated: inserted,
    membersUpdated: plan.toUpdate.length,
    membersSkipped: plan.toSkip,
    membersReactivated: plan.toReactivate.length,
    membersArchived: plan.toArchive.length,
    rowErrors: plan.errors.length,
  };

  await logAudit(admin.id, "import", "roster", null, stats);

  return NextResponse.json({ message: "Import complete", stats, errors: plan.errors.slice(0, 100) });
}
