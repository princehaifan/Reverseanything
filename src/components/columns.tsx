import type { AppSummary } from '../../server/api-types';
import { fmtMoney, fmtNum } from '../format';
import { AppCell, Delta, WatchButton, type Column } from './ui';

type Row = AppSummary & { rank?: number };

/** The standard app-performance columns shared by every app table. */
export function appColumns<T extends Row>(opts: { rank?: boolean; watch?: boolean } = {}): Column<T>[] {
  const cols: Column<T>[] = [];
  if (opts.rank) cols.push({ key: 'rank', label: '#', className: 'rank', render: (r) => r.rank, csv: (r) => r.rank ?? null });
  cols.push(
    { key: 'app', label: 'App', render: (r) => <AppCell app={r} />, sort: (r) => r.name.toLowerCase(), csv: (r) => r.name },
    { key: 'publisher', label: 'Publisher', render: () => null, className: 'csv-only', csv: (r) => r.publisher },
    { key: 'category', label: 'Category', render: (r) => <span className="chip">{r.genre ?? r.category}</span>, sort: (r) => r.genre ?? r.category, csv: (r) => r.genre ?? r.category },
    { key: 'downloads', label: 'Downloads', num: true, render: (r) => fmtNum(r.downloads), sort: (r) => r.downloads, csv: (r) => Math.round(r.downloads) },
    { key: 'dlc', label: 'Change', num: true, render: (r) => <Delta value={r.downloadsChange} />, sort: (r) => r.downloadsChange, csv: (r) => r.downloadsChange },
    { key: 'revenue', label: 'Revenue', num: true, render: (r) => fmtMoney(r.revenue), sort: (r) => r.revenue, csv: (r) => Math.round(r.revenue) },
    { key: 'revc', label: 'Change', num: true, render: (r) => <Delta value={r.revenueChange} />, sort: (r) => r.revenueChange, csv: (r) => r.revenueChange },
    { key: 'dau', label: 'DAU', num: true, render: (r) => fmtNum(r.dau), sort: (r) => r.dau, csv: (r) => Math.round(r.dau) },
    { key: 'rpd', label: 'Rev / download', num: true, render: (r) => fmtMoney(r.rpd), sort: (r) => r.rpd, csv: (r) => Number(r.rpd.toFixed(3)) },
  );
  if (opts.watch) cols.push({ key: 'watch', label: '', num: true, render: (r) => <WatchButton id={r.id} /> });
  return cols;
}
