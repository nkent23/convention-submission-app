"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: number;
  email: string;
  name: string;
  lastLoginAt: string | null;
  createdAt: string;
};

export default function AdminsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [generated, setGenerated] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/admins");
    setRows(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setError("");
    const body: Record<string, string> = { email: form.email, name: form.name };
    if (form.password) body.password = form.password;
    const res = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    if (data.generatedPassword) {
      setGenerated({ email: data.email, password: data.generatedPassword });
    }
    setAdding(false);
    setForm({ email: "", name: "", password: "" });
    load();
  };

  const resetPassword = async (row: Row) => {
    const password = prompt(`New password for ${row.email} (min 8 characters):`);
    if (!password) return;
    const res = await fetch(`/api/admin/admins/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) alert(data.error ?? "Password reset failed");
    else alert("Password updated.");
  };

  const remove = async (row: Row) => {
    if (!confirm(`Remove admin ${row.email}?`)) return;
    const res = await fetch(`/api/admin/admins/${row.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) alert(data.error ?? "Delete failed");
    load();
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Admins</h1>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-ehs-700 px-4 py-2 text-sm font-medium text-white hover:bg-ehs-800"
        >
          + Add Admin
        </button>
      </div>

      {generated && (
        <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm">
          <p className="font-medium text-gray-900">
            One-time password for {generated.email}:{" "}
            <code className="rounded bg-white px-2 py-0.5">{generated.password}</code>
          </p>
          <p className="mt-1 text-gray-600">
            Share it securely now — it will not be shown again.{" "}
            <button className="text-ehs-700 underline" onClick={() => setGenerated(null)}>
              Dismiss
            </button>
          </p>
        </div>
      )}

      {loading ? (
        <p className="py-8 text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Last login</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-900">{row.email}</td>
                  <td className="px-4 py-2 text-gray-600">{row.name || "—"}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {row.lastLoginAt
                      ? new Date(row.lastLoginAt).toLocaleString("en-US", {
                          timeZone: "America/Chicago",
                        })
                      : "Never"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button
                      onClick={() => resetPassword(row)}
                      className="mr-3 text-ehs-700 hover:underline"
                    >
                      Reset password
                    </button>
                    <button onClick={() => remove(row)} className="text-crimson-700 hover:underline">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Add Admin</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 p-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Password (leave blank to generate a one-time password)
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
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
                  onClick={() => setAdding(false)}
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
