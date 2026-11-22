import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Compare as CompareData, TopApp } from '../../server/api-types';
import { TrendCard } from '../components/charts';
import { AppCell, Async, Card, Delta, Icon, PageHead, Seg } from '../components/ui';
import { fmtMoney, fmtNum, fmtPct, FORMATS, METRIC_LABEL, SERIES, type MetricKey } from '../format';
import { useApi } from '../state';

const METRICS = [['downloads', 'Downloads'], ['revenue', 'Revenue'], ['dau', 'Active users']] as const;
const SLOTS = 4;

export default function Compare() {
  const [params, setParams] = useSearchParams();
  // Each app keeps its slot (and so its colour) for as long as it is selected.
  const slots: (string | null)[] = Array.from({ length: SLOTS }, (_, i) => (params.get('ids') ?? '').split(',')[i] || null);
  const setSlot = (i: number, id: string | null) => {
    const next = [...slots];
    next[i] = id;
    while (next.length && !next[next.length - 1]) next.pop();
    setParams(next.length ? { ids: next.map((x) => x ?? '').join(',') } : {}, { replace: true });
  };
  const [metric, setMetric] = useState<MetricKey>('downloads');
  const ids = slots.filter(Boolean) as string[];
  const catalog = useApi<TopApp[]>('/apps/top', { metric: 'downloads', limit: 200 });
  const state = useApi<CompareData>(ids.length ? '/apps/compare' : null, { ids: ids.join(',') });

  const colorOf = (id: string) => SERIES[slots.indexOf(id)];
  const byId = new Map((state.data?.apps ?? []).map((a) => [a.id, a]));
  const options = (catalog.data ?? []).filter((a) => !ids.includes(a.id)).sort((a, b) => a.name.localeCompare(b.name));

  const rows: [string, (a: CompareData['apps'][number]) => React.ReactNode][] = [
    ['Downloads', (a) => <>{fmtNum(a.downloads)} <Delta value={a.downloadsChange} /></>],
    ['Revenue', (a) => <>{fmtMoney(a.revenue)} <Delta value={a.revenueChange} /></>],
    ['Daily active users', (a) => <>{fmtNum(a.dau)} <Delta value={a.dauChange} /></>],
    ['Revenue per download', (a) => fmtMoney(a.rpd)],
    ['Revenue per daily active user', (a) => fmtMoney(a.dau ? a.revenue / a.series.revenue.length / a.dau : 0)],
    ['Stickiness (DAU / MAU)', (a) => fmtPct(a.stickiness)],
    ['Day 1 retention', (a) => fmtPct(a.d1)],
    ['Day 7 retention', (a) => fmtPct(a.d7)],
    ['Day 30 retention', (a) => fmtPct(a.d30)],
    ['Store rating', (a) => a.rating.toFixed(2)],
  ];

  return (
    <>
      <PageHead title="Compare apps" subtitle="Benchmark up to four apps side by side. The link in your address bar captures the selection.">
        <Seg label="Metric" value={metric} onChange={setMetric} options={METRICS} />
      </PageHead>
      <div className="slots">
        {slots.map((id, i) => {
          const a = id ? byId.get(id) : null;
          return a ? (
            <div className="slot" key={i}>
              <i className="key" style={{ background: SERIES[i] }} />
              <AppCell app={a} size={28} sub={a.genre ?? a.category} />
              <span className="spacer" />
              <button className="btn ghost small" onClick={() => setSlot(i, null)} aria-label={`Remove ${a.name}`}><Icon name="close" size={14} /></button>
            </div>
          ) : (
            <div className="slot empty-slot" key={i}>
              <select aria-label={`Add app to slot ${i + 1}`} value="" onChange={(e) => setSlot(i, e.target.value || null)}>
                <option value="">{id ? 'Loading…' : '+ Add an app'}</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.genre ?? o.category})</option>)}
              </select>
            </div>
          );
        })}
      </div>
      {!ids.length ? (
        <div className="notice"><strong>Pick an app to start.</strong> Add a second one to see how they stack up on downloads, revenue, engagement and retention.</div>
      ) : (
        <Async state={state}>
          {(d) => (
            <>
              <div className="grid">
                <TrendCard className="span-12" title={METRIC_LABEL[metric]} subtitle="Daily, for the selected market and platform" height={300}
                  csvName={`compare-${metric}`} labels={d.dates} format={FORMATS[metric]}
                  series={d.apps.map((a) => ({ name: a.name, values: a.series[metric], color: colorOf(a.id) }))} />
              </div>
              <div className="grid">
                <Card className="span-12" flush title="Head to head" subtitle="Period totals with change vs the previous period">
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          {d.apps.map((a) => <th key={a.id} className="num"><i className="key" style={{ background: colorOf(a.id), display: 'inline-block', marginRight: 6 }} />{a.name}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(([label, cell]) => (
                          <tr key={label}><td>{label}</td>{d.apps.map((a) => <td key={a.id} className="num">{cell(a)}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </>
          )}
        </Async>
      )}
    </>
  );
}
