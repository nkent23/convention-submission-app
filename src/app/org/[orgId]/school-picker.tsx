"use client";

import { useState } from "react";
import Link from "next/link";

export default function SchoolPicker({
  orgId,
  schools,
}: {
  orgId: number;
  schools: { id: number; name: string }[];
}) {
  const [term, setTerm] = useState("");

  const filtered =
    term.trim() === ""
      ? schools
      : schools.filter((s) => s.name.toLowerCase().includes(term.toLowerCase()));

  if (schools.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500">
        No schools available for this organization.
      </p>
    );
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Search for your school..."
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        className="mb-4 w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-ehs-600"
      />
      <div className="max-h-96 space-y-3 overflow-y-auto">
        {filtered.length > 0 ? (
          filtered.map((school) => (
            <Link
              key={school.id}
              href={`/org/${orgId}/school/${school.id}`}
              className="block w-full rounded-lg border border-gray-200 p-4 text-left font-medium text-gray-900 transition-colors hover:border-ehs-600 hover:bg-ehs-50"
            >
              {school.name}
            </Link>
          ))
        ) : (
          <div className="py-8 text-center">
            <p className="text-gray-500">No schools found matching &quot;{term}&quot;.</p>
            <p className="mt-2 text-sm text-gray-600">
              Try a different search term or check the spelling.
            </p>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-sm text-gray-600">
        Showing {filtered.length} of {schools.length} schools
      </p>
    </div>
  );
}
