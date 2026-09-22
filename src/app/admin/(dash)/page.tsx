import Link from "next/link";
import { db } from "@/db/client";
import { members, organizations, schools, verifications } from "@/db/schema";
import { count, desc, eq, gte, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [[orgCount], [schoolCount], [activeMembers], [archivedMembers], [verif30], recent] =
    await Promise.all([
      db.select({ n: count() }).from(organizations),
      db.select({ n: count() }).from(schools),
      db.select({ n: count() }).from(members).where(eq(members.status, "active")),
      db.select({ n: count() }).from(members).where(eq(members.status, "archived")),
      db.select({ n: count() }).from(verifications).where(gte(verifications.verifiedAt, since30d)),
      db
        .select({
          name: members.name,
          school: schools.name,
          at: verifications.verifiedAt,
        })
        .from(verifications)
        .innerJoin(members, eq(verifications.memberId, members.id))
        .innerJoin(schools, eq(members.schoolId, schools.id))
        .orderBy(desc(verifications.verifiedAt))
        .limit(15),
    ]);

  const stats = [
    { label: "Organizations", value: orgCount.n },
    { label: "Schools", value: schoolCount.n },
    { label: "Active members", value: activeMembers.n },
    { label: "Archived members", value: archivedMembers.n },
    { label: "Verifications (30 days)", value: verif30.n },
  ];

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Dashboard</h1>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-ehs-700">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Recent verifications</h2>
        <Link href="/admin/verifications" className="text-sm text-ehs-700 hover:underline">
          View all →
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="text-gray-500">No verifications yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2">School</th>
                <th className="px-4 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-2 text-gray-600">{r.school}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {r.at.toLocaleString("en-US", { timeZone: "America/Chicago" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
