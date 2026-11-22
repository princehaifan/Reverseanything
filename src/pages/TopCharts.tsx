import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { TopApp, TopPublisher } from '../../server/api-types';
import { appColumns } from '../components/columns';
import { AppIcon, Async, Card, DataTable, Delta, ExportButton, PageHead, RankDelta, Seg, Select, tableCsv, type Column } from '../components/ui';
import { fmtMoney, fmtNum, METRIC_LABEL, type MetricKey } from '../format';
import { useApi, useApp } from '../state';

const METRICS = [['downloads', 'Downloads'], ['revenue', 'Revenue'], ['dau', 'Active users']] as const;

const publisherColumns: Column<TopPublisher>[] = [
  { key: 'rank', label: '#', className: 'rank', render: (r) => r.rank, csv: (r) => r.rank },
  { key: 'name', label: 'Publisher', render: (r) => <Link to={`/publishers/${r.id}`} style={{ fontWeight: 550 }}>{r.name}</Link>, sort: (r) => r.name, csv: (r) => r.name },
  { key: 'kind', label: 'Focus', render: (r) => <span className="chip">{r.kind}</span>, csv: (r) => r.kind },
  { key: 'country', label: 'HQ', render: (r) => r.country, sort: (r) => r.country, csv: (r) => r.country },
  { key: 'apps', label: 'Apps', num: true, render: (r) => r.apps, sort: (r) => r.apps, csv: (r) => r.apps },
  { key: 'downloads', label: 'Downloads', num: true, render: (r) => fmtNum(r.downloads), sort: (r) => r.downloads, csv: (r) => Math.round(r.downloads) },
  { key: 'dlc', label: 'Change', num: true, render: (r) => <Delta value={r.downloadsChange} />, sort: (r) => r.downloadsChange, csv: (r) => r.downloadsChange },
  { key: 'revenue', label: 'Revenue', num: true, render: (r) => fmtMoney(r.revenue), sort: (r) => r.revenue, csv: (r) => Math.round(r.revenue) },
  { key: 'revc', label: 'Change', num: true, render: (r) => <Delta value={r.revenueChange} />, sort: (r) => r.revenueChange, csv: (r) => r.revenueChange },
  { key: 'dau', label: 'DAU', num: true, render: (r) => fmtNum(r.dau), sort: (r) => r.dau, csv: (r) => Math.round(r.dau) },
  {
    key: 'top', label: 'Top app', csv: (r) => r.topApp.name,
    render: (r) => <Link to={`/apps/${r.topApp.id}`} className="app-cell"><AppIcon name={r.topApp.name} hue={r.topApp.hue} size={22} /><span>{r.topApp.name}</span></Link>,
  },
];

export default function TopCharts() {
  const { meta } = useApp();
  const [view, setView] = useState<'apps' | 'publishers'>('apps');
  const [metric, setMetric] = useState<MetricKey>('downloads');
  const [category, setCategory] = useState('all');
  const [limit, setLimit] = useState(50);

  const apps = useApi<TopApp[]>(view === 'apps' ? '/apps/top' : null, { metric, category, limit });
  const pubs = useApi<TopPublisher[]>(view === 'publishers' ? '/publishers/top' : null,
    { metric, kind: category === 'Games' ? 'Games' : category === 'apps' ? 'Apps' : 'all' });

  const appCols: Column<TopApp>[] = (() => {
    const cols = appColumns<TopApp>({ rank: true, watch: true });
    cols.splice(1, 0, { key: 'move', label: 'Move', render: (r) => <RankDelta value={r.rankChange} />, csv: (r) => r.rankChange });
    return cols;
  })();

  const categoryOptions = view === 'apps'
    ? [
        ['all', 'All categories'] as const, ['Games', 'All games'] as const, ['apps', 'All non-game apps'] as const,
        { group: 'Game genres', items: (meta?.genres ?? []).map((g) => [g, g] as const) },
        { group: 'App categories', items: (meta?.categories ?? []).map((c) => [c, c] as const) },
      ]
    : [['all', 'All publishers'] as const, ['Games', 'Game publishers'] as const, ['apps', 'App publishers'] as const];

  return (
    <>
      <PageHead title="App performance" subtitle={`Top ${view} ranked by ${METRIC_LABEL[metric].toLowerCase()} for the selected market, platform and period.`}>
        <Seg label="View" value={view} onChange={(v) => { setView(v); setCategory('all'); }} options={[['apps', 'Apps'], ['publishers', 'Publishers']]} />
        <Seg label="Rank by" value={metric} onChange={setMetric} options={METRICS} />
        <Select label="Category" value={category} onChange={setCategory} options={categoryOptions} />
        {view === 'apps' && <Select label="Rows" value={String(limit)} onChange={(v) => setLimit(Number(v))} options={[['25', 'Top 25'], ['50', 'Top 50'], ['100', 'Top 100'], ['200', 'All']]} />}
      </PageHead>
      {view === 'apps' ? (
        <Async state={apps}>
          {(rows) => (
            <Card flush title={`Top apps by ${METRIC_LABEL[metric].toLowerCase()}`} subtitle="“Move” is the change in rank vs the previous period. Click a column to re-sort."
              tools={<ExportButton name={`top-apps-${metric}`} {...tableCsv(appCols, rows)} />}>
              <DataTable columns={appCols} rows={rows} rowKey={(r) => r.id} />
            </Card>
          )}
        </Async>
      ) : (
        <Async state={pubs}>
          {(rows) => (
            <Card flush title={`Top publishers by ${METRIC_LABEL[metric].toLowerCase()}`} subtitle="Totals across each publisher's tracked portfolio."
              tools={<ExportButton name={`top-publishers-${metric}`} {...tableCsv(publisherColumns, rows)} />}>
              <DataTable columns={publisherColumns} rows={rows} rowKey={(r) => r.id} />
            </Card>
          )}
        </Async>
      )}
    </>
  );
}
