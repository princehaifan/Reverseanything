import { Link, useSearchParams } from 'react-router-dom';
import type { Audience, TopApp } from '../../server/api-types';
import { BarList, Columns, HeatCell, SegmentBar, TrendCard } from '../components/charts';
import { AppCell, AppIcon, Async, Card, DataTable, PageHead, Select, Stat, type Column } from '../components/ui';
import { fmtDateLong, fmtNum, fmtPct, SERIES } from '../format';
import { useApi } from '../state';

const overlapColumns: Column<Audience['overlap'][number]>[] = [
  { key: 'app', label: 'Also uses', render: (r) => <AppCell app={r} size={28} sub={r.genre ?? r.category} /> },
  { key: 'overlap', label: 'Audience overlap', num: true, render: (r) => fmtPct(r.overlap), sort: (r) => r.overlap },
  { key: 'aff', label: 'Affinity index', num: true, render: (r) => r.affinity, sort: (r) => r.affinity },
];

export default function AudiencePage() {
  const [params, setParams] = useSearchParams();
  const catalog = useApi<TopApp[]>('/apps/top', { metric: 'dau', limit: 200 });
  const id = params.get('app') ?? catalog.data?.[0]?.id ?? null;
  const state = useApi<Audience>(id ? `/audience/${id}` : null);
  const options = [...(catalog.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHead title="Audience" subtitle="Who uses an app, what else they use, and how well it keeps them.">
        <Select label="App" value={id ?? ''} onChange={(v) => setParams({ app: v }, { replace: true })}
          options={options.map((o) => [o.id, `${o.name} (${o.genre ?? o.category})`] as const)} />
      </PageHead>
      <Async state={state}>
        {(d) => {
          const seg = d.app.genre ?? d.app.category;
          const cohortMax = Math.max(...d.cohorts.map((c) => c.d1 ?? 0));
          return (
            <>
              <div className="hero">
                <AppIcon name={d.app.name} hue={d.app.hue} size={48} />
                <div>
                  <h1 style={{ fontSize: 20 }}><Link to={`/apps/${d.app.id}`}>{d.app.name}</Link></h1>
                  <div className="sub"><span>{d.app.publisher}</span><span className="chip">{seg}</span></div>
                </div>
              </div>
              <div className="grid">
                <Stat label="Daily active users" value={fmtNum(d.reach.dau)} foot="average, all markets" />
                <Stat label="Monthly active users" value={fmtNum(d.reach.mau)} foot={`${fmtPct(d.reach.stickiness, 0)} come back daily`} />
                <Stat label="Sessions per user per day" value={d.engagement.sessions.toFixed(1)} />
                <Stat label="Minutes per session" value={d.engagement.minutes.toFixed(1)} foot={`${(d.engagement.sessions * d.engagement.minutes).toFixed(0)} min per user per day`} />
              </div>
              <div className="grid">
                <Card className="span-6" title="Age" subtitle={`Share of users by age band, vs the ${seg} average`}>
                  <Columns labels={d.ages.map((a) => a.band)} format={(n) => fmtPct(n, 0)} series={[
                    { name: d.app.name, values: d.ages.map((a) => a.share) },
                    { name: `${seg} average`, values: d.ages.map((a) => a.benchmark), color: 'var(--other)' },
                  ]} />
                </Card>
                <Card className="span-6" title="Gender" subtitle="Share of users">
                  <div style={{ display: 'grid', gap: 14 }}>
                    {([[d.app.name, d.gender.female], [`${seg} average`, d.gender.benchmarkFemale], ['All tracked apps', d.gender.marketFemale]] as const).map(([name, f]) => (
                      <div key={name}>
                        <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 4 }}>{name}</div>
                        <SegmentBar items={[{ name: 'Women', value: f, color: SERIES[4] }, { name: 'Men', value: 1 - f, color: SERIES[0] }]} />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
              <div className="grid">
                <Card className="span-5" title="Interests" subtitle="Categories this audience over-indexes on (100 is average)">
                  <BarList format={(n) => String(Math.round(n))} items={d.interests.map((i) => ({ label: i.segment, value: i.index }))} />
                </Card>
                <Card className="span-7" flush title="Cross-app usage" subtitle="Share of this app's users who are also active in another app">
                  <DataTable compact columns={overlapColumns} rows={d.overlap} rowKey={(r) => r.id} />
                </Card>
              </div>
              <div className="grid">
                <TrendCard className="span-6" title="Retention curve" subtitle={`Share of new users still active, vs the ${seg} average`}
                  csvName={`${d.app.id}-retention`} xLabel="Day" labels={d.retention.map((r) => `D${r.day}`)} format={(n) => fmtPct(n, 0)}
                  series={[
                    { name: d.app.name, values: d.retention.map((r) => r.value) },
                    { name: `${seg} average`, values: d.retentionBenchmark.map((r) => r.value), color: 'var(--other)' },
                  ]} />
                <Card className="span-6" title="Usage by hour" subtitle="Share of daily sessions by local hour">
                  <Columns labels={d.hourly.map((h) => String(h.hour).padStart(2, '0'))} format={(n) => fmtPct(n, 0)} height={240}
                    series={[{ name: 'Share of sessions', values: d.hourly.map((h) => h.share) }]} />
                </Card>
              </div>
              <div className="grid">
                <Card className="span-12" flush title="Weekly install cohorts" subtitle="Retention of each week's new users. Recent cohorts have not reached the later milestones yet.">
                  <div className="table-wrap" style={{ padding: '0 16px 12px' }}>
                    <table className="data heat">
                      <thead><tr><th>Cohort week</th><th className="num">New users</th>{['Day 1', 'Day 3', 'Day 7', 'Day 14', 'Day 30'].map((h) => <th key={h} style={{ textAlign: 'center' }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {d.cohorts.map((c) => (
                          <tr key={c.cohort}>
                            <td style={{ paddingLeft: 0 }}>{fmtDateLong(c.cohort)}</td>
                            <td className="num">{fmtNum(c.size)}</td>
                            {[c.d1, c.d3, c.d7, c.d14, c.d30].map((v, i) => <HeatCell key={i} value={v} max={cohortMax} format={(n) => fmtPct(n, 0)} />)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
