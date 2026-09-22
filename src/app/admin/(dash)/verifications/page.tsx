"use client";

import { useEffect, useRef, useState } from "react";

type Org = { id: number; name: string };
type Row = {
  id: number;
  verifiedAt: string;
  memberName: string;
  schoolName: string;
  orgName: string;
};

export default function VerificationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [q, setQ] = useState("");
  const [orgId, setOrgId] = useState(0);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/admin/organizations").then((r) => r.json()).then(setOrgs);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page) });
      if (q) params.set("q", q);
      if (orgId) params.set("orgId", String(orgId));
      const res = await fetch(`/api/admin/verifications?${params}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setPageSize(data.pageSize ?? 50);
      setLoading(false);
    }, q ? 300 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [page, q, orgId]);

  const exportUrl = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (orgId) params.set("orgId", String(orgId));
    return `/api/admin/verifications/export?${params}`;
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Verifications</h1>
        <a
          href={exportUrl()}
          className="rounded-lg border border-ehs-700 px-4 py-2 text-sm font-medium text-ehs-700 hover:bg-ehs-50"
        >
          Export CSV
        </a>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search member names..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="w-64 rounded-lg border border-gray-300 p-2 text-sm"
        />
        <select
          value={orgId}
          onChange={(e) => {
            setOrgId(Number(e.target.value));
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 p-2 text-sm"
        >
          <option value={0}>All organizations</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <span className="self-center text-sm text-gray-500">
          {total.toLocaleString()} verification{total === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <p className="py-8 text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">When (Central)</th>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2">School</th>
                <th className="px-4 py-2">Organization</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">
                    {new Date(row.verifiedAt).toLocaleString("en-US", {
                      timeZone: "America/Chicago",
                    })}
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-900">{row.memberName}</td>
                  <td className="px-4 py-2 text-gray-600">{row.schoolName}</td>
                  <td className="px-4 py-2 text-gray-600">{row.orgName}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No verifications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="text-sm text-gray-600">
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
          className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
