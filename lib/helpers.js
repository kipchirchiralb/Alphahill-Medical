/** Shared formatting and text utilities used by both public pages and the dashboard. */

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Turns a post title into a URL-safe slug. */
function slugify(title) {
  const base = String(title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);

  return base || `post-${Date.now()}`;
}

/**
 * Appends -2, -3 … until the slug is free. `excludeId` lets a post keep its
 * own slug while being edited.
 */
async function uniqueSlug(pool, desired, excludeId = null) {
  let candidate = desired;
  let suffix = 1;

  for (;;) {
    const [rows] = await pool.execute(
      "SELECT id FROM news WHERE slug = ? AND (? IS NULL OR id <> ?) LIMIT 1",
      [candidate, excludeId, excludeId]
    );

    if (rows.length === 0) return candidate;

    suffix += 1;
    candidate = `${desired}-${suffix}`;
  }
}

/**
 * Renders a plain-text post body as HTML: blank lines separate paragraphs and
 * single newlines become line breaks. Input is escaped first, so author text
 * can never inject markup.
 */
function bodyToHtml(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

/** Builds a short summary from the body when the author leaves the excerpt blank. */
function deriveExcerpt(body, limit = 180) {
  const flat = String(body || "")
    .replace(/\s+/g, " ")
    .trim();

  if (flat.length <= limit) return flat;
  return `${flat.slice(0, limit).replace(/\s+\S*$/, "")}…`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "12 August 2026" — avoids locale differences between server environments. */
function formatDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "12 Aug 2026, 14:05" for dashboard tables. */
function formatDateTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()}, ${hours}:${minutes}`;
}

/** Formats a DATE column for an <input type="date"> without timezone drift. */
function toDateInput(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/** Initials for the review avatar, e.g. "Jane C." -> "JC". */
function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Shortens a full name for public display: "Jane Chebet" -> "Jane C.".
 * Reviewers submit their full name but we only publish the surname initial.
 */
function publicName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "Anonymous";
  if (parts.length === 1) return parts[0];

  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** Serialises rows to CSV, quoting every field so commas and newlines survive. */
function toCsv(columns, rows) {
  const cell = (value) => {
    if (value == null) return '""';
    let text = value instanceof Date ? formatDateTime(value) : String(value);
    // A leading =, +, - or @ makes spreadsheets treat the cell as a formula.
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };

  const header = columns.map((column) => cell(column.label)).join(",");
  const body = rows
    .map((row) => columns.map((column) => cell(row[column.key])).join(","))
    .join("\r\n");

  return `${header}\r\n${body}`;
}

module.exports = {
  escapeHtml,
  slugify,
  uniqueSlug,
  bodyToHtml,
  deriveExcerpt,
  formatDate,
  formatDateTime,
  toDateInput,
  initials,
  publicName,
  toCsv,
};
