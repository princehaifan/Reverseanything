import { useState } from 'react';
import type { LiveChart, LiveEntry } from '../../server/api-types';
import { Async, Card, DataTable, ExportButton, Icon, PageHead, Seg, Select, tableCsv, type Column } from '../components/ui';
import { fmtNum } from '../format';
import { useApi, useApp } from '../state';

const COUNTRY_NAMES: Record<string, string> = {
  us: 'United States', gb: 'United Kingdom', de: 'Germany', fr: 'France', jp: 'Japan', kr: 'South Korea',
  br: 'Brazil', in: 'India', id: 'Indonesia', mx: 'Mexico', ca: 'Canada', cn: 'China',
};

const CHART_NAMES: Record<string, string> = { 'top-free': 'Top free', 'top-paid': 'Top paid', 'top-grossing': 'Top grossing' };

const columns: Column<LiveEntry>[] = [
  { key: 'rank', label: '#', className: 'rank', render: (r) => r.rank, csv: (r) => r.rank },
  {
    key: 'app', label: 'App', sort: (r) => r.name.toLowerCase(), csv: (r) => r.name,
    render: (r) => (
      <span className="app-cell">
        <img src={r.icon} alt="" width={36} height={36} loading="lazy" style={{ borderRadius: 9, flex: 'none', background: 'var(--surface-2)' }}
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        <span className="meta"><span className="name">{r.name}</span><span className="sub">{r.publisher}</span></span>
      </span>
    ),
  },
  { key: 'publisher', label: 'Publisher', className: 'csv-only', render: () => null, csv: (r) => r.publisher },
  { key: 'genre', label: 'Genre', render: (r) => (r.genre ? <span className="chip">{r.genre}</span> : '–'), sort: (r) => r.genre, csv: (r) => r.genre },
  { key: 'rating', label: 'Rating', num: true, render: (r) => (r.rating === null ? '–' : <><span className="stars">★</span> {r.rating.toFixed(1)}</>), sort: (r) => r.rating, csv: (r) => r.rating },
  { key: 'count', label: 'Ratings', num: true, render: (r) => fmtNum(r.ratingCount), sort: (r) => r.ratingCount, csv: (r) => r.ratingCount },
  { key: 'price', label: 'Price', num: true, render: (r) => r.price ?? '–', csv: (r) => r.price },
  { key: 'released', label: 'Released', num: true, render: (r) => r.releaseDate ?? '–', sort: (r) => r.releaseDate, csv: (r) => r.releaseDate },
  { key: 'link', label: '', num: true, csv: (r) => r.url, render: (r) => <a className="btn ghost small" href={r.url} target="_blank" rel="noreferrer" aria-label={`Open ${r.name} in the App Store`}><Icon name="external" size={14} /></a> },
];

export default function Live() {
  const { meta } = useApp();
  const [country, setCountry] = useState('us');
  const [chart, setChart] = useState('top-free');
  const state = useApi<LiveChart>('/live/charts', { country, chart }, false);
  return (
    <>
      <PageHead title="Live App Store charts" subtitle="Real, current free, paid and grossing rankings from Apple's public chart feed. Unlike the rest of Tidemark, nothing on this page is modelled.">
        <Seg label="Chart" value={chart} onChange={setChart} options={[['top-free', 'Top free'], ['top-paid', 'Top paid'], ['top-grossing', 'Top grossing']]} />
        <Select label="Storefront" value={country} onChange={setCountry}
          options={(meta?.live.countries ?? ['us']).map((c) => [c, COUNTRY_NAMES[c] ?? c.toUpperCase()] as const)} />
        <button className="btn" onClick={state.reload} disabled={state.loading}>Refresh</button>
      </PageHead>
      <Async state={state}>
        {(d) => d.available ? (
          <Card flush title={`${CHART_NAMES[d.chart] ?? d.chart} apps, ${COUNTRY_NAMES[d.country] ?? d.country}`}
            subtitle={d.fetchedAt ? `Fetched ${new Date(d.fetchedAt).toLocaleString()}. Cached for up to 30 minutes.` : undefined}
            tools={<ExportButton name={`app-store-${d.chart}-${d.country}`} {...tableCsv(columns, d.entries)} />}>
            <DataTable columns={columns} rows={d.entries} rowKey={(r) => r.id} />
          </Card>
        ) : (
          <div className="notice" role="status">
            <strong>Live charts are unavailable right now.</strong> {d.reason} The server needs outbound HTTPS access to{' '}
            <code>itunes.apple.com</code>. Everything else in Tidemark keeps working without it.
          </div>
        )}
      </Async>
    </>
  );
}
