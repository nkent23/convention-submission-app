"use client";

import { useCallback, useEffect, useState } from "react";

type Row = { id: number; name: string; schoolCount: number; memberCount: number };

export default function OrganizationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/organizations");
    setRows(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    setError("");
    const isNew = editing.id === 0;
    const res = await fetch(
      isNew ? "/api/admin/organizations" : `/api/admin/organizations/${editing.id}`,
      {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editing.name }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setEditing(null);
    load();
  };

  const remove = async (row: Row) => {
    if (
      !confirm(
        `Delete ${row.name}? This also deletes its ${row.schoolCount} schools and ${row.memberCount} members.`,
      )
    )
      return;
    await fetch(`/api/admin/organizations/${row.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
        <button
          onClick={() => setEditing({ id: 0, name: "" })}
          className="rounded-lg bg-ehs-700 px-4 py-2 text-sm font-medium text-white hover:bg-ehs-800"
        >
          + Add Organization
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Organization</th>
                <th className="px-4 py-2">Schools</th>
                <th className="px-4 py-2">Members</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-2 text-gray-600">{row.schoolCount}</td>
                  <td className="px-4 py-2 text-gray-600">{row.memberCount}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button
                      onClick={() => setEditing({ id: row.id, name: row.name })}
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
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No organizations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              {editing.id === 0 ? "Add Organization" : "Edit Organization"}
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
