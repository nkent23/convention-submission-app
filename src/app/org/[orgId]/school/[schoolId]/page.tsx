import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { organizations, schools } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import NameSearch from "./name-search";

export const dynamic = "force-dynamic";

export default async function SchoolPage({
  params,
}: {
  params: Promise<{ orgId: string; schoolId: string }>;
}) {
  const { orgId, schoolId } = await params;
  const oid = Number(orgId);
  const sid = Number(schoolId);
  if (!Number.isInteger(oid) || !Number.isInteger(sid)) notFound();

  const [row] = await db
    .select({ school: schools, orgName: organizations.name })
    .from(schools)
    .innerJoin(organizations, eq(schools.organizationId, organizations.id))
    .where(and(eq(schools.id, sid), eq(schools.organizationId, oid)))
    .limit(1);
  if (!row) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-br from-ehs-50 to-ehs-100">
      <div className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-4xl font-bold text-gray-900">
              Membership Validation Portal
            </h1>
          </div>
          <div className="rounded-lg bg-white p-8 shadow-lg">
            <div className="mb-6">
              <Link
                href={`/org/${oid}`}
                className="mb-2 inline-block text-ehs-700 hover:text-ehs-800"
              >
                ← Back to Schools
              </Link>
              <h2 className="text-2xl font-semibold text-gray-900">Step 3: Find Your Name</h2>
              <p className="text-gray-600">
                {row.orgName} → {row.school.name}
              </p>
            </div>
            <NameSearch schoolId={sid} />
          </div>
        </div>
      </div>
    </div>
  );
}
