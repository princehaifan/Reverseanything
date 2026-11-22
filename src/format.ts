const compact = (n: number, digits = 1) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(a >= 1e10 ? digits : 2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e8 ? 0 : digits)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(a >= 1e5 ? 0 : digits)}K`;
  return Math.round(n).toLocaleString('en-US');
};
export const fmtNum = (n: number | null | undefined) => (n == null ? '–' : compact(n));
export const fmtMoney = (n: number | null | undefined) =>
  n == null ? '–' : Math.abs(n) < 100 ? `$${n.toFixed(2)}` : `$${compact(n)}`;
export const fmtPct = (n: number | null | undefined, digits = 1) =>
  n == null ? '–' : `${(n * 100).toFixed(digits)}%`;
export const fmtChange = (n: number | null | undefined) =>
  n == null ? 'new' : `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(1)}%`;
export const fmtDuration = (sec: number) =>
  `${Math.floor(sec / 60)}m ${String(Math.floor(sec % 60)).padStart(2, '0')}s`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-03-09" becomes "Mar 9". */
export const fmtDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
export const fmtDateLong = (iso: string) => `${fmtDate(iso)}, ${iso.slice(0, 4)}`;

export type Formatter = (n: number) => string;
export const METRIC_LABEL = { downloads: 'Downloads', revenue: 'Revenue', dau: 'Daily active users' } as const;
export type MetricKey = keyof typeof METRIC_LABEL;
export const FORMATS: Record<MetricKey, Formatter> = { downloads: fmtNum, revenue: fmtMoney, dau: fmtNum };

/** Categorical colour slots, always assigned in this fixed order. */
export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);
export const OTHER_COLOR = 'var(--other)';

export function toCsv(head: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\n');
}

export function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
