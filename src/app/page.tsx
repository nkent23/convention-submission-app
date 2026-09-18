import Link from "next/link";
import { db } from "@/db/client";
import { organizations } from "@/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const orgs = await db.select().from(organizations).orderBy(asc(organizations.name));

  return (
    <div className="min-h-screen bg-gradient-to-br from-ehs-50 to-ehs-100">
      <div className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-4xl font-bold text-gray-900">
              Membership Validation Portal
            </h1>
            <p className="text-gray-600">
              Select your organization, school, and name to access your submission form
            </p>
          </div>

          <div className="rounded-lg bg-white p-8 shadow-lg">
            <h2 className="mb-6 text-2xl font-semibold text-gray-900">
              Step 1: Select Your Organization
            </h2>
            {orgs.length === 0 ? (
              <p className="py-8 text-center text-gray-500">
                No organizations available yet. Please check back later.
              </p>
            ) : (
              <div className="space-y-3">
                {orgs.map((org) => (
                  <Link
                    key={org.id}
                    href={`/org/${org.id}`}
                    className="block w-full rounded-lg border border-gray-200 p-4 text-left font-medium text-gray-900 transition-colors hover:border-ehs-600 hover:bg-ehs-50"
                  >
                    {org.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
