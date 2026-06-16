import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isPast } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "MMM d, yyyy");
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "MMM d, yyyy h:mm a");
}

export function formatRelative(d: Date | string) {
  return formatDistanceToNow(new Date(d), { addSuffix: true });
}

export function isOverdue(d: Date | string | null | undefined) {
  if (!d) return false;
  return isPast(new Date(d));
}

export function maskVoucherCode(code: string): string {
  if (code.length <= 4) return "****";
  return "*".repeat(code.length - 4) + code.slice(-4);
}

export function generateCode(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(5, "0")}`;
}

export function exportToCsv<T extends Record<string, unknown>>(rows: T[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = r[h];
        const s = v == null ? "" : String(v);
        return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

export function parseCsvResults(text: string): Array<{ employeeId: string; score: number; attended: boolean }> {
  const lines = text.trim().split("\n").filter(Boolean);
  const results: Array<{ employeeId: string; score: number; attended: boolean }> = [];
  for (const line of lines) {
    const parts = line.split(/[,;\t]/).map((p) => p.trim());
    if (parts.length < 2) continue;
    const employeeId = parts[0];
    const score = parseInt(parts[1], 10);
    const attended = parts[2]?.toLowerCase() !== "no" && parts[2]?.toLowerCase() !== "noshow";
    if (employeeId && !isNaN(score)) results.push({ employeeId, score, attended });
  }
  return results;
}
