/**
 * Format a Date to ISO date string (YYYY-MM-DD).
 */
export function toDateString(d: Date = new Date()): string {
  return d.toISOString().split("T")[0];
}

/**
 * Format a Date to a filesystem-safe timestamp string.
 * Replaces colons with underscores for directory names.
 */
export function toSafeTimestamp(d: Date = new Date()): string {
  return d.toISOString().replace(/:/g, "_").replace(/\.\d+Z$/, "Z");
}

/**
 * Parse a safe timestamp back to ISO string.
 */
export function fromSafeTimestamp(safe: string): string {
  return safe.replace(/_/g, ":");
}

/**
 * Check if a date string matches YYYY-MM-DD format and is within a reasonable range.
 */
export function isValidDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str);
  if (isNaN(d.getTime())) return false;
  const year = d.getFullYear();
  return year >= 2020 && year <= 2100;
}

/**
 * Return relative time description in Japanese.
 */
export function relativeTimeJa(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "たった今";
  if (mins < 60) return `${mins}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return `${Math.floor(days / 30)}ヶ月前`;
}
