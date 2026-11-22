import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fmtDate, fmtDateLong, fmtPct, SERIES, type Formatter } from '../format';
import { Card, ExportButton, Icon, Legend } from './ui';

export interface Series { name: string; values: (number | null)[]; color?: string }

const AXIS_TICK = { fill: 'var(--muted)', fontSize: 11 };
const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function Tip({ active, payload, label, format, showTotal }: {
  active?: boolean; payload?: { name: string; value: number | null; color: string; dataKey: string }[];
  label?: string; format: Formatter; showTotal?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const rows = showTotal ? [...payload].reverse() : payload;
  return (
    <div className="tip">
      <div className="tip-title">{label && isIsoDate(label) ? fmtDateLong(label) : label}</div>
      {rows.map((p) => (
        <div className="tip-row" key={p.dataKey}>
          <i className="key line" style={{ background: p.color }} />
          <span>{p.name}</span>
          <b>{p.value == null ? '–' : format(p.value)}</b>
        </div>
      ))}
      {showTotal && rows.length > 1 && (
        <div className="tip-row"><i className="key line" style={{ background: 'transparent' }} /><span>Total</span>
          <b>{format(rows.reduce((t, p) => t + (p.value ?? 0), 0))}</b></div>
      )}
    </div>
  );
}

/**
 * Line / stacked-area chart over a shared x axis. One y axis only: series of
 * different units belong in separate charts.
 */
export function TrendChart({ labels, series, format, stacked = false, height = 240, reversed = false, integerTicks = false }: {
  labels: string[]; series: Series[]; format: Formatter; stacked?: boolean; height?: number;
  /** Flip the y axis (rank charts: 1 at the top). */
  reversed?: boolean; integerTicks?: boolean;
}) {
  const data = labels.map((label, i) => {
    const row: Record<string, string | number | null> = { label };
    series.forEach((s, k) => { row[`s${k}`] = s.values[i] ?? null; });
    return row;
  });
  const colors = series.map((s, k) => s.color ?? SERIES[k]);
  const dated = labels.length > 0 && isIsoDate(labels[0]);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--axis)' }}
          tickFormatter={(v: string) => (dated ? fmtDate(v) : v)} minTickGap={36} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} tickFormatter={format}
          reversed={reversed} allowDecimals={!integerTicks} domain={reversed ? [1, 'dataMax'] : [0, 'auto']} />
        <Tooltip content={<Tip format={format} showTotal={stacked} />} cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
          isAnimationActive={false} />
        {series.map((s, k) => stacked
          ? <Area key={k} dataKey={`s${k}`} name={s.name} stackId="stack" type="monotone" isAnimationActive={false}
              stroke="var(--surface)" strokeWidth={1.5} fill={colors[k]} fillOpacity={0.9} activeDot={false} />
          : series.length === 1
            ? <Area key={k} dataKey={`s${k}`} name={s.name} type="monotone" isAnimationActive={false} connectNulls={false}
                stroke={colors[k]} strokeWidth={2} fill={colors[k]} fillOpacity={0.1}
                activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} />
            : <Line key={k} dataKey={`s${k}`} name={s.name} type="monotone" isAnimationActive={false} dot={false}
                stroke={colors[k]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} />)}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** A trend chart in a card, with its legend, a table-view twin and CSV export. */
export function TrendCard({ title, subtitle, labels, series, format, className = '', csvName, xLabel = 'Date', tools, ...chart }: {
  title: string; subtitle?: ReactNode; labels: string[]; series: Series[]; format: Formatter; className?: string;
  csvName: string; xLabel?: string; tools?: ReactNode;
  stacked?: boolean; height?: number; reversed?: boolean; integerTicks?: boolean;
}) {
  const [asTable, setAsTable] = useState(false);
  const colors = series.map((s, k) => s.color ?? SERIES[k]);
  const head = [xLabel, ...series.map((s) => s.name)];
  const raw = () => labels.map((l, i) => [l, ...series.map((s) => s.values[i] ?? null)]);
  return (
    <Card title={title} subtitle={subtitle} className={className} tools={<>
      {tools}
      <button className="btn small" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}
        title={asTable ? 'Show chart' : 'Show data table'}>
        <Icon name={asTable ? 'chart' : 'table'} size={14} /> {asTable ? 'Chart' : 'Table'}
      </button>
      <ExportButton name={csvName} head={head} rows={raw} />
    </>}>
      {series.length > 1 && <Legend line={!chart.stacked} items={series.map((s, k) => ({ name: s.name, color: colors[k] }))} />}
      {asTable ? (
        <div className="table-scroll" style={{ maxHeight: chart.height ?? 240 }}>
          <table className="data compact">
            <thead><tr>{head.map((h, i) => <th key={h} className={i ? 'num' : ''}>{h}</th>)}</tr></thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={l}>
                  <td>{isIsoDate(l) ? fmtDateLong(l) : l}</td>
                  {series.map((s, k) => <td key={k} className="num">{s.values[i] == null ? '–' : format(s.values[i]!)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <TrendChart labels={labels} series={series} format={format} {...chart} />}
    </Card>
  );
}

/** Ranked horizontal bars. Every bar shows its label and value, so it is its own table. */
export function BarList({ items, format, color = SERIES[0], showShare = false }: {
  items: { label: string; value: number; to?: string; color?: string }[]; format: Formatter; color?: string; showShare?: boolean;
}) {
  const max = Math.max(...items.map((i) => i.value), 0) || 1;
  const sum = items.reduce((t, i) => t + i.value, 0) || 1;
  return (
    <div className="barlist">
      {items.map((it) => (
        <div className="barlist-row" key={it.label} title={`${it.label}: ${format(it.value)} (${fmtPct(it.value / sum)})`}>
          {it.to ? <Link className="label" to={it.to}>{it.label}</Link> : <span className="label">{it.label}</span>}
          <div className="track"><div className="fill" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? color }} /></div>
          <span className="value">{format(it.value)}{showShare && <small>{fmtPct(it.value / sum, 0)}</small>}</span>
        </div>
      ))}
    </div>
  );
}

/** One whole split into parts. Shares are printed inside blocks wide enough to hold them. */
export function SegmentBar({ items }: { items: { name: string; value: number; color: string }[] }) {
  const sum = items.reduce((t, i) => t + i.value, 0) || 1;
  const parts = items.filter((i) => i.value > 0);
  const label = parts.map((i) => `${i.name} ${fmtPct(i.value / sum, 0)}`).join(', ');
  return (
    <div>
      <div className="segbar" role="img" aria-label={label}>
        {parts.map((i) => {
          const share = i.value / sum;
          return (
            <div key={i.name} title={`${i.name}: ${fmtPct(share)}`}
              className={i.color === SERIES[3] ? 'dark-ink' : undefined}
              style={{ flex: `${share} 1 0`, background: i.color }}>
              {share >= 0.09 ? fmtPct(share, 0) : ''}
            </div>
          );
        })}
      </div>
      <div className="legend" style={{ margin: '10px 0 0' }}>
        {parts.map((i) => (
          <span key={i.name} title={fmtPct(i.value / sum)}>
            <i className="key" style={{ background: i.color }} />{i.name}
            {i.value / sum < 0.09 && <b style={{ fontWeight: 550, color: 'var(--text)' }}>{fmtPct(i.value / sum, 0)}</b>}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Grouped columns for a small number of ordered categories (age bands, star ratings). */
export function Columns({ labels, series, format, height = 220 }: {
  labels: string[]; series: Series[]; format: Formatter; height?: number;
}) {
  const data = labels.map((label, i) => {
    const row: Record<string, string | number | null> = { label };
    series.forEach((s, k) => { row[`s${k}`] = s.values[i]; });
    return row;
  });
  return (
    <>
      {series.length > 1 && <Legend items={series.map((s, k) => ({ name: s.name, color: s.color ?? SERIES[k] }))} />}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} interval={0} />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={format} />
          <Tooltip content={<Tip format={format} />} cursor={{ fill: 'var(--hover)' }} isAnimationActive={false} />
          {series.map((s, k) => (
            <Bar key={k} dataKey={`s${k}`} name={s.name} fill={s.color ?? SERIES[k]} maxBarSize={24}
              radius={[4, 4, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

export function Sparkline({ values, width = 96, height = 30 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 3 - ((v - min) / span) * (height - 6)}`);
  const [lx, ly] = pts[pts.length - 1].split(',');
  return (
    <svg className="spark" width={width} height={height} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke="var(--axis)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}

/** Average every `size` points so long ranges stay readable in a sparkline. */
export function bucket(values: number[], buckets = 24): number[] {
  if (values.length <= buckets) return values;
  const size = values.length / buckets;
  return Array.from({ length: buckets }, (_, b) => {
    const slice = values.slice(Math.floor(b * size), Math.floor((b + 1) * size));
    return slice.reduce((a, c) => a + c, 0) / (slice.length || 1);
  });
}

/** Sequential single-hue cell: darker means more. The number is always printed. */
export function HeatCell({ value, max, format }: { value: number | null; max: number; format: Formatter }) {
  if (value === null) return <td className="cell" style={{ color: 'var(--muted)' }}>–</td>;
  const t = Math.min(1, value / (max || 1));
  return (
    <td className={`cell${t > 0.55 ? ' strong' : ''}`} style={{ background: `rgba(var(--seq-rgb), ${0.1 + t * 0.85})` }}>
      {format(value)}
    </td>
  );
}
