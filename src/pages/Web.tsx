import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SiteDetail as Detail, WebOverview } from '../../server/api-types';
import { BarList, SegmentBar, TrendCard } from '../components/charts';
import { AppIcon, Async, Card, DataTable, Delta, ExportButton, PageHead, Select, Stat, tableCsv, type Column } from '../components/ui';
import { fmtDuration, fmtNum, fmtPct, OTHER_COLOR, SERIES } from '../format';
import { useApi } from '../state';

type SiteRow = WebOverview['sites'][number] | Detail['competitors'][number];
function SiteCell({ s }: { s: { domain: string; name: string; hue: number } }) {
  return (
    <span className="app-cell">
      <AppIcon name={s.name} hue={s.hue} size={28} />
      <span className="meta"><Link className="name" to={`/web/${s.domain}`}>{s.domain}</Link><span className="sub">{s.name}</span></span>
    </span>
  );
}
function siteColumns<T extends SiteRow>(rank: boolean): Column<T>[] {
  const cols: Column<T>[] = [
    { key: 'site', label: 'Website', render: (r) => <SiteCell s={r} />, sort: (r) => r.domain, csv: (r) => r.domain },
    { key: 'cat', label: 'Category', render: (r) => <span className="chip">{r.category}</span>, sort: (r) => r.category, csv: (r) => r.category },
    { key: 'visits', label: 'Visits', num: true, render: (r) => fmtNum(r.visits), sort: (r) => r.visits, csv: (r) => Math.round(r.visits) },
    { key: 'chg', label: 'Change', num: true, render: (r) => <Delta value={r.visitsChange} />, sort: (r) => r.visitsChange, csv: (r) => r.visitsChange },
    { key: 'uniq', label: 'Unique visitors', num: true, render: (r) => fmtNum(r.uniques), sort: (r) => r.uniques, csv: (r) => Math.round(r.uniques) },
    { key: 'dur', label: 'Visit duration', num: true, render: (r) => fmtDuration(r.duration), sort: (r) => r.duration, csv: (r) => Math.round(r.duration) },
    { key: 'pages', label: 'Pages / visit', num: true, render: (r) => r.pages.toFixed(1), sort: (r) => r.pages, csv: (r) => Number(r.pages.toFixed(2)) },
    { key: 'bounce', label: 'Bounce rate', num: true, render: (r) => fmtPct(r.bounce, 0), sort: (r) => r.bounce, csv: (r) => Number(r.bounce.toFixed(3)) },
    { key: 'mobile', label: 'Mobile share', num: true, render: (r) => fmtPct(r.mobile, 0), sort: (r) => r.mobile, csv: (r) => Number(r.mobile.toFixed(3)) },
    { key: 'src', label: 'Top source', render: (r) => r.topSource, sort: (r) => r.topSource, csv: (r) => r.topSource },
  ];
  if (rank) cols.unshift({ key: 'rank', label: '#', className: 'rank', render: (r) => ('rank' in r ? r.rank : ''), csv: (r) => ('rank' in r ? r.rank : null) });
  return cols;
}
const overviewColumns = siteColumns<WebOverview['sites'][number]>(true);
const competitorColumns = siteColumns<Detail['competitors'][number]>(false);
const sourceItems = (items: { name: string; value: number }[]) => items.map((s, i) => ({ ...s, color: SERIES[i] }));

export function Web() {
  const [category, setCategory] = useState('all');
  const state = useApi<WebOverview>('/web/overview', { category });
  return (
    <>
      <PageHead title="Web traffic" subtitle="Visits, engagement and acquisition channels for tracked websites. The platform filter does not apply here.">
        <Select label="Category" value={category} onChange={setCategory}
          options={[['all', 'All categories'], ...(state.data?.categories ?? []).map((c) => [c, c] as const)]} />
      </PageHead>
      <Async state={state}>
        {(d) => (
          <>
            <div className="grid">
              <Stat label="Total visits" value={fmtNum(d.kpis.visits.value)} change={d.kpis.visits.change} foot="vs previous period" />
              <Stat label="Average visit duration" value={fmtDuration(d.kpis.duration)} foot="weighted by visits" />
              <Stat label="Bounce rate" value={fmtPct(d.kpis.bounce)} foot="weighted by visits" />
              <Stat label="Mobile web share" value={fmtPct(d.kpis.mobile)} foot="of all visits" />
            </div>
            <div className="grid">
              <Card className="span-6" title="Traffic sources" subtitle="How visitors arrive">
                <SegmentBar items={sourceItems(d.sources)} />
              </Card>
              <Card className="span-6" title="Visits by category" subtitle="Share of tracked traffic">
                <SegmentBar items={d.byCategory.map((s, i) => ({ ...s, color: s.name === 'Other' ? OTHER_COLOR : SERIES[i] }))} />
              </Card>
            </div>
            <div className="grid">
              <Card className="span-12" flush title="Top websites" subtitle="Ranked by visits"
                tools={<ExportButton name="top-websites" {...tableCsv(overviewColumns, d.sites)} />}>
                <DataTable columns={overviewColumns} rows={d.sites} rowKey={(r) => r.domain} />
              </Card>
            </div>
          </>
        )}
      </Async>
    </>
  );
}

export function SiteDetail() {
  const { domain = '' } = useParams();
  const state = useApi<Detail>(`/web/sites/${domain}`);
  return (
    <Async state={state}>
      {(d) => (
        <>
          <div className="crumbs"><Link to="/web">Web traffic</Link> / {d.category}</div>
          <div className="hero">
            <AppIcon name={d.name} hue={d.hue} size={56} />
            <div>
              <h1>{d.domain}</h1>
              <div className="sub">
                <span>{d.name}</span><span className="chip">{d.category}</span>
                {d.app && <Link to={`/apps/${d.app.id}`}>View the {d.app.name} app</Link>}
              </div>
            </div>
          </div>
          <div className="grid">
            <Stat label="Visits" value={fmtNum(d.visits)} change={d.visitsChange} foot="vs previous period" />
            <Stat label="Unique visitors" value={fmtNum(d.uniques)} foot={`${d.pages.toFixed(1)} pages per visit`} />
            <Stat label="Average visit duration" value={fmtDuration(d.duration)} />
            <Stat label="Bounce rate" value={fmtPct(d.bounce)} />
          </div>
          <div className="grid">
            <TrendCard className="span-8" title="Visits" subtitle="Daily, for the selected market" csvName={`${d.domain}-visits`}
              labels={d.dates} format={fmtNum} series={[{ name: 'Visits', values: d.series }]} height={260} />
            <Card className="span-4" title="Traffic sources" subtitle="Share of visits by channel">
              <BarList format={fmtNum} showShare items={d.sources.map((s, i) => ({ label: s.name, value: s.value, color: SERIES[i] }))} />
            </Card>
          </div>
          <div className="grid">
            <Card className="span-4" title="Devices" subtitle="Share of visits">
              <SegmentBar items={d.devices.map((x, i) => ({ ...x, color: SERIES[i] }))} />
              <h2 style={{ fontSize: 14, margin: '20px 0 10px' }}>Top referring sites</h2>
              <BarList format={fmtNum} items={d.referrers.map((r) => ({ label: r.domain, value: r.visits, to: `/web/${r.domain}` }))} />
            </Card>
            <Card className="span-4" title="Top search keywords" subtitle="Share of organic search visits">
              <BarList format={(n) => fmtPct(n)} color={SERIES[2]} items={d.keywords.slice(0, 9).map((k) => ({ label: k.keyword, value: k.share }))} />
            </Card>
            <Card className="span-4" title="Visits by market" subtitle="All tracked markets">
              <BarList format={fmtNum} showShare items={[...d.countries].sort((a, b) => b.visits - a.visits).slice(0, 9).map((c) => ({ label: c.name, value: c.visits }))} />
            </Card>
          </div>
          <div className="grid">
            <Card className="span-12" flush title="Competing websites" subtitle={`Other tracked ${d.category} sites`}>
              <DataTable columns={competitorColumns} rows={d.competitors} rowKey={(r) => r.domain} empty="No other tracked sites in this category." />
            </Card>
          </div>
        </>
      )}
    </Async>
  );
}
