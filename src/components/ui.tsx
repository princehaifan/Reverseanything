import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { downloadCsv, fmtChange, toCsv } from '../format';
import { useApp, type ApiState } from '../state';

// ------------------------------------------------------------------ icons
const PATHS: Record<string, string> = {
  overview: 'M3 13h6V3H3zm8 4h6V3h-6zM3 17h6v-2H3z',
  apps: 'M3 3h6v6H3zm8 0h6v6h-6zM3 11h6v6H3zm8 0h6v6h-6z',
  compare: 'M4 16V8m5 8V4m5 12v-6',
  ads: 'M3 8v4h3l5 4V4L6 8zm11-1a4 4 0 0 1 0 6',
  web: 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM2 10h16M10 2c2.5 2.6 2.5 13.4 0 16M10 2c-2.5 2.6-2.5 13.4 0 16',
  audience: 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 8c0-3 2-5 5-5s5 2 5 5m2-8a2.5 2.5 0 1 0 0-5m1 13c0-2.4-.8-4-2.5-4.6',
  games: 'M6 6h8a4 4 0 0 1 4 4l-1 5a2 2 0 0 1-3.6.8L12 14H8l-1.4 1.8A2 2 0 0 1 3 15l-1-5a4 4 0 0 1 4-4zm0 3v3m-1.5-1.5h3m6-.5h.01M12.5 11h.01',
  live: 'M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.8 14.2a6 6 0 0 1 0-8.4m8.4 0a6 6 0 0 1 0 8.4M3 17a10 10 0 0 1 0-14m14 0a10 10 0 0 1 0 14',
  star: 'M10 2.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2L10 14.3l-4.6 2.5.9-5.2L2.5 8l5.2-.7z',
  search: 'M9 15A6 6 0 1 0 9 3a6 6 0 0 0 0 12zm8 2l-3.7-3.7',
  download: 'M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 16h12',
  table: 'M3 4h14v12H3zM3 8h14M3 12h14M8 4v12',
  chart: 'M3 16l4-5 3 3 6-8',
  sun: 'M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-11v2m0 12v2M2 10h2m12 0h2M4.3 4.3l1.4 1.4m8.6 8.6l1.4 1.4m0-11.4l-1.4 1.4m-8.6 8.6l-1.4 1.4',
  moon: 'M16 11.5A7 7 0 0 1 8.5 4 6.5 6.5 0 1 0 16 11.5z',
  info: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-9v5m0-8h.01',
  close: 'M5 5l10 10M15 5L5 15',
  external: 'M8 4H4v12h12v-4M11 3h6v6m0-6l-8 8',
};
export function Icon({ name, filled = false, size = 16 }: { name: string; filled?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// ---------------------------------------------------------------- identity
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export function AppIcon({ name, hue, size = 32 }: { name: string; hue: number; size?: number }) {
  return (
    <span className="icon" aria-hidden="true" style={{
      width: size, height: size, borderRadius: size * 0.24, fontSize: size * 0.38,
      background: `linear-gradient(140deg, hsl(${hue} 68% 52%), hsl(${(hue + 40) % 360} 72% 38%))`,
    }}>
      {initials(name)}
    </span>
  );
}

interface AppLike { id: string; name: string; hue: number; publisher?: string; category?: string; genre?: string | null }
export function AppCell({ app, sub, size = 32 }: { app: AppLike; sub?: ReactNode; size?: number }) {
  return (
    <span className="app-cell">
      <AppIcon name={app.name} hue={app.hue} size={size} />
      <span className="meta">
        <Link className="name" to={`/apps/${app.id}`}>{app.name}</Link>
        <span className="sub">{sub ?? app.publisher}</span>
      </span>
    </span>
  );
}

export function WatchButton({ id, label = false }: { id: string; label?: boolean }) {
  const { watchlist, toggleWatch } = useApp();
  const on = watchlist.includes(id);
  return (
    <button className={label ? 'btn' : 'btn ghost small'} aria-pressed={on} onClick={() => toggleWatch(id)}
      title={on ? 'Remove from watchlist' : 'Add to watchlist'} aria-label={on ? 'Remove from watchlist' : 'Add to watchlist'}>
      <Icon name="star" filled={on} size={label ? 16 : 15} />
      {label && (on ? 'Watching' : 'Watch')}
    </button>
  );
}

// ----------------------------------------------------------------- figures
/** Signed change vs the previous period. The arrow carries direction alongside colour. */
export function Delta({ value, goodWhenUp = true }: { value: number | null | undefined; goodWhenUp?: boolean }) {
  if (value == null) return <span className="delta flat">new</span>;
  const flat = Math.abs(value) < 0.0005;
  const up = value > 0;
  const cls = flat ? 'flat' : up === goodWhenUp ? 'up' : 'down';
  return <span className={`delta ${cls}`}>{flat ? '' : up ? '▲' : '▼'} {fmtChange(value).replace(/^[+−]/, '')}</span>;
}

export function RankDelta({ value }: { value: number | null }) {
  if (value === null) return <span className="chip accent">new</span>;
  if (value === 0) return <span className="delta flat">–</span>;
  return <span className={`delta ${value > 0 ? 'up' : 'down'}`}>{value > 0 ? '▲' : '▼'} {Math.abs(value)}</span>;
}

export function Stat({ label, value, change, foot, children, className = 'span-3' }: {
  label: string; value: string; change?: number | null; foot?: ReactNode; children?: ReactNode; className?: string;
}) {
  return (
    <div className={`card stat ${className}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-row">
        <div className="stat-value">{value}</div>
        {children}
      </div>
      <div className="stat-foot">
        {change !== undefined && <Delta value={change} />}
        {foot}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ layout
export function Card({ title, subtitle, tools, children, className = '', flush = false }: {
  title?: string; subtitle?: ReactNode; tools?: ReactNode; children: ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || tools) && (
        <header className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {tools && <div className="card-tools">{tools}</div>}
        </header>
      )}
      <div className={`card-body${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  );
}

export function Seg<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[]; label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} aria-pressed={v === value} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

export function Select({ value, onChange, options, label }: {
  value: string; onChange: (v: string) => void; label: string;
  options: readonly (readonly [string, string] | { group: string; items: readonly (readonly [string, string])[] })[];
}) {
  return (
    <select className="select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => 'group' in o
        ? <optgroup key={o.group} label={o.group}>{o.items.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</optgroup>
        : <option key={o[0]} value={o[0]}>{o[1]}</option>)}
    </select>
  );
}

/** Renders loading / error states, and dims stale data while a refetch runs. */
export function Async<T>({ state, children }: { state: ApiState<T>; children: (data: T) => ReactNode }) {
  if (state.data) return <div className={state.loading ? 'stale' : undefined} aria-busy={state.loading}>{children(state.data)}</div>;
  if (state.error) {
    return (
      <div className="state" role="alert">
        <div>{state.error}</div>
        <button className="btn" onClick={state.reload}>Try again</button>
      </div>
    );
  }
  return <div className="state" aria-busy="true">Loading…</div>;
}

export function Legend({ items, line = false }: { items: { name: string; color: string }[]; line?: boolean }) {
  return (
    <div className="legend">
      {items.map((s) => (
        <span key={s.name}><i className={line ? 'key line' : 'key'} style={{ background: s.color }} />{s.name}</span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ tables
export interface Column<T> {
  key: string; label: string; num?: boolean; className?: string;
  render: (row: T, index: number) => ReactNode;
  /** Enables click-to-sort on this column. */
  sort?: (row: T) => number | string | null;
  /** Value used for CSV export; omit to leave the column out of the file. */
  csv?: (row: T) => string | number | null;
}

export function ExportButton({ name, head, rows }: { name: string; head: string[]; rows: () => (string | number | null)[][] }) {
  return (
    <button className="btn small" onClick={() => downloadCsv(`${name}.csv`, toCsv(head, rows()))} title="Download as CSV">
      <Icon name="download" size={14} /> CSV
    </button>
  );
}

export function DataTable<T>({ columns, rows, rowKey, compact = false, empty = 'Nothing to show for these filters.' }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; compact?: boolean; empty?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x === null) return 1;
      if (y === null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sort!.dir;
    });
  }, [rows, columns, sort]);

  if (!rows.length) return <div className="empty">{empty}</div>;
  const toggle = (c: Column<T>) =>
    setSort((s) => (s?.key === c.key ? (s.dir === -1 ? { key: c.key, dir: 1 } : null) : { key: c.key, dir: -1 }));
  return (
    <div className="table-wrap">
      <table className={`data${compact ? ' compact' : ''}`}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`${c.num ? 'num' : ''} ${c.className ?? ''}`}
                aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                {c.sort
                  ? <button onClick={() => toggle(c)}>{c.label}{sort?.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</button>
                  : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => <td key={c.key} className={`${c.num ? 'num' : ''} ${c.className ?? ''}`}>{c.render(row, i)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function tableCsv<T>(columns: Column<T>[], rows: T[]) {
  const cols = columns.filter((c) => c.csv);
  return { head: cols.map((c) => c.label), rows: () => rows.map((r) => cols.map((c) => c.csv!(r))) };
}

export function PageHead({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-tools">{children}</div>}
    </div>
  );
}
