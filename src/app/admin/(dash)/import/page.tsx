"use client";

import { useState } from "react";

type PreviewStats = {
  rowsInFile: number;
  validRows: number;
  duplicateRowsInFile: number;
  organizationsToCreate: string[];
  schoolsToCreate: number;
  membersToCreate: number;
  membersToUpdate: number;
  membersToSkip: number;
  membersToReactivate: number;
  membersToArchive: number;
};

type Preview = {
  stats: PreviewStats;
  errors: { line: number; message: string }[];
  sampleCreates: { organization: string; school: string; name: string }[];
  sampleArchives: string[];
};

export default function ImportPage() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [duplicateHandling, setDuplicateHandling] = useState<"skip" | "update">("skip");
  const [archiveMissing, setArchiveMissing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string>("");

  const readFile = (file: File) => {
    setFileName(file.name);
    setPreview(null);
    setResult("");
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const run = async (mode: "preview" | "commit") => {
    setBusy(true);
    setError("");
    if (mode === "commit") setResult("");
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, mode, duplicateHandling, archiveMissing }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      if (mode === "preview") {
        setPreview(data);
      } else {
        const s = data.stats;
        setResult(
          `Import complete: ${s.membersCreated} created, ${s.membersUpdated} updated, ` +
            `${s.membersSkipped} skipped, ${s.membersReactivated} reactivated, ` +
            `${s.membersArchived} archived. ${s.organizationsCreated} new organizations, ` +
            `${s.schoolsCreated} new schools. ${s.rowErrors} row errors.`,
        );
        setPreview(null);
        setCsv("");
        setFileName("");
      }
    } catch {
      setError("Request failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Bulk Import</h1>
      <p className="mb-6 text-gray-600">
        Upload a CSV with columns <code className="rounded bg-gray-100 px-1">organization</code>,{" "}
        <code className="rounded bg-gray-100 px-1">school</code>,{" "}
        <code className="rounded bg-gray-100 px-1">member_name</code>,{" "}
        <code className="rounded bg-gray-100 px-1">submission_url</code>. Missing organizations
        and schools are created automatically. Nothing is written until you commit.
      </p>

      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-6">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
          className="mb-4 block text-sm"
        />
        {fileName && (
          <p className="mb-4 text-sm text-gray-600">
            Loaded <span className="font-medium">{fileName}</span> ({(csv.length / 1024).toFixed(0)} KB)
          </p>
        )}

        <div className="mb-4 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={duplicateHandling === "skip"}
              onChange={() => setDuplicateHandling("skip")}
            />
            Skip members that already exist
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={duplicateHandling === "update"}
              onChange={() => setDuplicateHandling("update")}
            />
            Update submission URLs of members that already exist
          </label>
          <label className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
            <input
              type="checkbox"
              checked={archiveMissing}
              onChange={(e) => setArchiveMissing(e.target.checked)}
            />
            <span>
              <span className="font-medium">New cycle:</span> archive active members of these
              organizations who are not in this file
            </span>
          </label>
        </div>

        <button
          onClick={() => run("preview")}
          disabled={!csv || busy}
          className="rounded-lg bg-ehs-700 px-4 py-2 text-sm font-medium text-white hover:bg-ehs-800 disabled:opacity-50"
        >
          {busy && !preview ? "Analyzing..." : "Preview Import"}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {result && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {result}
        </p>
      )}

      {preview && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Preview</h2>
          <ul className="mb-4 space-y-1 text-sm text-gray-700">
            <li>{preview.stats.validRows.toLocaleString()} valid rows ({preview.stats.rowsInFile.toLocaleString()} in file, {preview.stats.duplicateRowsInFile} duplicate rows collapsed)</li>
            <li className="font-medium text-ehs-700">
              {preview.stats.membersToCreate.toLocaleString()} members will be created
            </li>
            <li>{preview.stats.membersToUpdate.toLocaleString()} will have their URL updated</li>
            <li>{preview.stats.membersToSkip.toLocaleString()} already exist and will be skipped</li>
            <li>{preview.stats.membersToReactivate.toLocaleString()} archived members will be reactivated</li>
            {preview.stats.membersToArchive > 0 && (
              <li className="font-medium text-crimson-700">
                {preview.stats.membersToArchive.toLocaleString()} members will be archived (not in file)
              </li>
            )}
            <li>
              New organizations:{" "}
              {preview.stats.organizationsToCreate.length > 0
                ? preview.stats.organizationsToCreate.join(", ")
                : "none"}{" "}
              · New schools: {preview.stats.schoolsToCreate}
            </li>
          </ul>

          {preview.errors.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-sm font-medium text-red-700">
                {preview.errors.length} row error{preview.errors.length === 1 ? "" : "s"} (these rows will be skipped):
              </p>
              <ul className="max-h-40 overflow-y-auto rounded border border-red-100 bg-red-50 p-2 text-xs text-red-700">
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => run("commit")}
            disabled={busy}
            className="rounded-lg bg-ehs-700 px-4 py-2 text-sm font-medium text-white hover:bg-ehs-800 disabled:opacity-50"
          >
            {busy ? "Importing..." : "Commit Import"}
          </button>
        </div>
      )}
    </div>
  );
}
