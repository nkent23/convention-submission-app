import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { organizations, schools } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import SchoolPicker from "./school-picker";

export const dynamic = "force-dynamic";

export default async function OrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const id = Number(orgId);
  if (!Number.isInteger(id)) notFound();

  const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!org) notFound();

  const schoolList = await db
    .select({ id: schools.id, name: schools.name })
    .from(schools)
    .where(eq(schools.organizationId, id))
    .orderBy(asc(schools.name));

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
              <Link href="/" className="mb-2 inline-block text-ehs-700 hover:text-ehs-800">
                ← Back to Organizations
              </Link>
              <h2 className="text-2xl font-semibold text-gray-900">
                Step 2: Select Your School
              </h2>
              <p className="text-gray-600">
                Organization: <span className="font-medium">{org.name}</span>
              </p>
            </div>
            <SchoolPicker orgId={org.id} schools={schoolList} />
          </div>
        </div>
      </div>
    </div>
  );
}
