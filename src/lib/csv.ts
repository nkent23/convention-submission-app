// Minimal RFC-4180-ish CSV parsing shared by import preview and commit.

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
      } else {
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      i++;
    } else {
      current += char;
      i++;
    }
  }
  result.push(current.trim());
  return result;
}

export type RosterRow = {
  line: number;
  organization: string;
  school: string;
  memberName: string;
  submissionUrl: string;
};

export type ParsedRoster = {
  rows: RosterRow[];
  errors: { line: number; message: string }[];
};

const REQUIRED = ["organization", "school", "member_name", "submission_url"] as const;

export function parseRosterCsv(csv: string): ParsedRoster | { headerError: string } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    return { headerError: "CSV must have a header row and at least one data row" };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const missing = REQUIRED.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return { headerError: `Missing required columns: ${missing.join(", ")}` };
  }

  const idx = Object.fromEntries(REQUIRED.map((c) => [c, headers.indexOf(c)]));
  const rows: RosterRow[] = [];
  const errors: { line: number; message: string }[] = [];

  lines.slice(1).forEach((raw, i) => {
    const line = i + 2; // 1-based, after header
    const values = parseCsvLine(raw);
    const row: RosterRow = {
      line,
      organization: values[idx.organization] ?? "",
      school: values[idx.school] ?? "",
      memberName: values[idx.member_name] ?? "",
      submissionUrl: values[idx.submission_url] ?? "",
    };
    if (!row.organization || !row.school || !row.memberName || !row.submissionUrl) {
      errors.push({ line, message: "Missing organization, school, member_name, or submission_url" });
      return;
    }
    try {
      new URL(row.submissionUrl);
    } catch {
      errors.push({ line, message: `Invalid submission_url: ${row.submissionUrl.slice(0, 80)}` });
      return;
    }
    rows.push(row);
  });

  return { rows, errors };
}
