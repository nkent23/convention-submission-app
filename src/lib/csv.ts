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

// Fix ALL-CAPS / all-lowercase roster names ("SMITH" -> "Smith") without
// touching deliberate mixed case like "McDonald" or "deLaCruz".
export function normalizeName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      const hasUpper = /[A-Z]/.test(word);
      const hasLower = /[a-z]/.test(word);
      if (hasUpper && hasLower) return word; // already mixed case — leave it
      return word
        .toLowerCase()
        .replace(/(^|[-'’.])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
    })
    .join(" ");
}

export function parseRosterCsv(
  csv: string,
  defaultSubmissionUrl = "",
): ParsedRoster | { headerError: string } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    return { headerError: "CSV must have a header row and at least one data row" };
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const missing = ["organization", "school"].filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    return { headerError: `Missing required columns: ${missing.join(", ")}` };
  }

  // Names come as one member_name column, or first_name + last_name.
  const hasFullName = headers.includes("member_name");
  const hasSplitName = headers.includes("first_name") && headers.includes("last_name");
  if (!hasFullName && !hasSplitName) {
    return {
      headerError:
        "CSV needs a member_name column, or first_name and last_name columns",
    };
  }

  const hasUrlColumn = headers.includes("submission_url");
  if (!hasUrlColumn && !defaultSubmissionUrl) {
    return {
      headerError:
        "CSV has no submission_url column — enter a Submission URL to apply to every member",
    };
  }

  const col = (name: string) => headers.indexOf(name);
  const rows: RosterRow[] = [];
  const errors: { line: number; message: string }[] = [];

  lines.slice(1).forEach((raw, i) => {
    const line = i + 2; // 1-based, after header
    const values = parseCsvLine(raw);
    const memberName = normalizeName(
      hasFullName
        ? (values[col("member_name")] ?? "")
        : `${values[col("first_name")] ?? ""} ${values[col("last_name")] ?? ""}`.trim(),
    );
    const row: RosterRow = {
      line,
      organization: values[col("organization")] ?? "",
      school: values[col("school")] ?? "",
      memberName,
      submissionUrl:
        (hasUrlColumn ? values[col("submission_url")] : "") || defaultSubmissionUrl,
    };
    if (!row.organization || !row.school || !row.memberName || !row.submissionUrl) {
      errors.push({ line, message: "Missing organization, school, member name, or submission URL" });
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
