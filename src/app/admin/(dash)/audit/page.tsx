"use client";

import { useEffect, useState } from "react";

type Row = {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  detail: unknown;
  createdAt: string;
  adminEmail: string | null;
};

export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/audit?page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
        setPageSize(data.pageSize ?? 50);
        setLoading(false);
      });
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Audit Log</h1>
      {loading ? (
        <p className="py-8 text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Admin</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">
                    {new Date(row.createdAt).toLocaleString("en-US", {
                      timeZone: "America/Chicago",
                    })}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{row.adminEmail ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{row.action}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {row.entity}
                    {row.entityId ? ` #${row.entityId}` : ""}
                  </td>
                  <td className="max-w-md truncate px-4 py-2 text-xs text-gray-500">
                    {row.detail ? JSON.stringify(row.detail) : ""}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No audit entries yet.
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
