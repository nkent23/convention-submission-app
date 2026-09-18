"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Org = { id: number; name: string };
type School = { id: number; name: string; organizationId: number };
type Row = {
  id: number;
  name: string;
  submissionUrl: string;
  status: "active" | "archived";
  schoolId: number;
  organizationId: number;
  schoolName: string;
  orgName: string;
};

type MemberForm = {
  id: number;
  name: string;
  schoolId: number;
  submissionUrl: string;
  status: "active" | "archived";
};

const emptyForm: MemberForm = { id: 0, name: "", schoolId: 0, submissionUrl: "", status: "active" };

export default function MembersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [q, setQ] = useState("");
  const [orgId, setOrgId] = useState(0);
  const [status, setStatus] = useState("");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MemberForm | null>(null);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (opts: { page: number; q: string; orgId: number; status: string }) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(opts.page) });
    if (opts.q) params.set("q", opts.q);
    if (opts.orgId) params.set("orgId", String(opts.orgId));
    if (opts.status) params.set("status", opts.status);
    const res = await fetch(`/api/admin/members?${params}`);
    const data = await res.json();
    setRows(data.rows ?? []);
    setTotal(data.total ?? 0);
    setPageSize(data.pageSize ?? 50);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch("/api/admin/organizations").then((r) => r.json()).then(setOrgs);
    fetch("/api/admin/schools").then((r) => r.json()).then(setSchools);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load({ page, q, orgId, status }), q ? 300 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [page, q, orgId, status, load]);

  const save = async () => {
    if (!editing) return;
    setError("");
    const isNew = editing.id === 0;
    const res = await fetch(isNew ? "/api/admin/members" : `/api/admin/members/${editing.id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editing.name,
        schoolId: editing.schoolId,
        submissionUrl: editing.submissionUrl,
        status: editing.status,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setEditing(null);
    load({ page, q, orgId, status });
  };

  const remove = async (row: Row) => {
    if (!confirm(`Delete ${row.name}? This also removes their verification history.`)) return;
    await fetch(`/api/admin/members/${row.id}`, { method: "DELETE" });
    load({ page, q, orgId, status });
  };

  const exportUrl = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (orgId) params.set("orgId", String(orgId));
    if (status) params.set("status", status);
    return `/api/admin/members/export?${params}`;
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Members</h1>
        <div className="flex gap-3">
          <a
            href={exportUrl()}
            className="rounded-lg border border-ehs-700 px-4 py-2 text-sm font-medium text-ehs-700 hover:bg-ehs-50"
          >
            Export CSV
          </a>
          <button
            onClick={() => setEditing({ ...emptyForm })}
            className="rounded-lg bg-ehs-700 px-4 py-2 text-sm font-medium text-white hover:bg-ehs-800"
          >
            + Add Member
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search names..."
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
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 p-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <span className="self-center text-sm text-gray-500">
          {total.toLocaleString()} member{total === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <p className="py-8 text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">School</th>
                <th className="px-4 py-2">Organization</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Submission URL</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-2 text-gray-600">{row.schoolName}</td>
                  <td className="px-4 py-2 text-gray-600">{row.orgName}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="max-w-56 truncate px-4 py-2 text-gray-500">{row.submissionUrl}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button
                      onClick={() =>
                        setEditing({
                          id: row.id,
                          name: row.name,
                          schoolId: row.schoolId,
                          submissionUrl: row.submissionUrl,
                          status: row.status,
                        })
                      }
                      className="mr-3 text-ehs-700 hover:underline"
                    >
                      Edit
                    </button>
                    <button onClick={() => remove(row)} className="text-crimson-700 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No members found.
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              {editing.id === 0 ? "Add Member" : "Edit Member"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">School</label>
                <select
                  value={editing.schoolId}
                  onChange={(e) => setEditing({ ...editing, schoolId: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 p-2"
                >
                  <option value={0}>Select a school...</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {orgs.find((o) => o.id === s.organizationId)?.name} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Submission URL
                </label>
                <input
                  type="url"
                  value={editing.submissionUrl}
                  onChange={(e) => setEditing({ ...editing, submissionUrl: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={editing.status}
                  onChange={(e) =>
                    setEditing({ ...editing, status: e.target.value as "active" | "archived" })
                  }
                  className="w-full rounded-lg border border-gray-300 p-2"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  className="rounded-lg bg-ehs-700 px-4 py-2 text-sm font-medium text-white hover:bg-ehs-800"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
