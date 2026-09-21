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

// Fix ALL-CAPS / all-lowercase roster names ("JANE SMITH" -> "Jane Smith")
// while preserving deliberate casing: mixed-case words (McDonald), Roman
// numeral suffixes (III, IV), lone initialisms in otherwise-normal names
// (JD Kettle), and lowercase particles (van, de, della).
const ROMAN_SUFFIX = /^(II|III|IV|V|VI|VII|VIII|IX|X)$/;
const PARTICLES = new Set([
  "van", "von", "de", "del", "della", "der", "den", "da", "das", "dos",
  "di", "du", "la", "le", "los", "las", "y", "ter", "ten", "bin", "ibn", "al", "el",
]);

export function normalizeName(name: string): string {
  const words = name.replace(/\s+/g, " ").trim().split(" ");
  const alphaWords = words.filter((w) => /[a-z]/i.test(w));
  const wholeNameAllCaps =
    alphaWords.length > 0 && alphaWords.every((w) => !/[a-z]/.test(w));

  return words
    .map((word, i) => {
      const hasUpper = /[A-Z]/.test(word);
      const hasLower = /[a-z]/.test(word);
      if (hasUpper && hasLower) return word; // deliberate mixed case
      if (hasUpper) {
        if (ROMAN_SUFFIX.test(word.replace(/\./g, ""))) return word;
        // An all-caps word in an otherwise-normal name is an initialism.
        if (!wholeNameAllCaps) return word;
      } else if (hasLower) {
        if (i > 0 && PARTICLES.has(word)) return word; // keep "van", "de", ...
        if (i > 0 && ROMAN_SUFFIX.test(word.toUpperCase().replace(/\./g, ""))) {
          return word.toUpperCase(); // "iii" -> "III"
        }
      }
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
