"use client";

import { useEffect, useRef, useState } from "react";

type Result = { id: number; name: string };

export default function NameSearch({ schoolId }: { schoolId: number }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Result | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?schoolId=${schoolId}&q=${encodeURIComponent(q)}`,
        );
        const data = await res.json();
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [term, schoolId]);

  const handleGo = async () => {
    if (!selected) return;
    setRedirecting(true);
    setError("");
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: selected.id }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
        setRedirecting(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setRedirecting(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Start typing your name..."
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setSelected(null);
        }}
        className="mb-4 w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-ehs-600"
      />

      {term.trim().length < 2 ? (
        <p className="py-8 text-center text-gray-500">
          Type at least 2 characters of your name to search.
        </p>
      ) : searching ? (
        <div className="flex items-center justify-center space-x-2 py-8">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-ehs-700"></div>
          <p className="text-sm text-gray-600">Searching...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="py-8 text-center">
          <p className="mb-4 text-gray-500">No members found matching &quot;{term}&quot;.</p>
          <p className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-gray-600">
            If your name is not listed under your school, please contact your Advisor to
            confirm your WriteAway status.
          </p>
        </div>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {results.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelected(selected?.id === member.id ? null : member)}
              className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors ${
                selected?.id === member.id
                  ? "border-ehs-600 bg-ehs-50 ring-2 ring-ehs-200"
                  : "border-gray-200 hover:border-ehs-300 hover:bg-ehs-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-gray-900">{member.name}</div>
                <div className={selected?.id === member.id ? "text-sm font-semibold text-ehs-700" : "text-sm text-gray-400"}>
                  {selected?.id === member.id ? "✓ Selected" : "Click to select"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-6 space-y-3">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="font-medium text-green-800">Selected: {selected.name}</p>
            <p className="mt-1 text-sm text-green-600">
              Ready to proceed to your submission page
            </p>
          </div>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            onClick={handleGo}
            disabled={redirecting}
            className="w-full rounded-lg bg-ehs-700 px-6 py-3 font-medium text-white transition-colors hover:bg-ehs-800 disabled:opacity-60"
          >
            {redirecting ? "Redirecting..." : "Go to Submission Page →"}
          </button>
        </div>
      )}
    </div>
  );
}
