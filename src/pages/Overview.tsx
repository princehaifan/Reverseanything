import { Link } from 'react-router-dom';
import type { Overview as OverviewData } from '../../server/api-types';
import { BarList, bucket, SegmentBar, Sparkline, TrendCard } from '../components/charts';
import { AppCell, Async, Card, Delta, PageHead, Stat } from '../components/ui';
import { fmtMoney, fmtNum, OTHER_COLOR, SERIES } from '../format';
import { useApi, useApp } from '../state';

const colored = (items: { name: string; value: number }[]) =>
  items.map((it, i) => ({ ...it, color: it.name === 'Other' ? OTHER_COLOR : SERIES[i] }));

function Movers({ title, rows }: { title: string; rows: OverviewData['gainers'] }) {
  return (
    <Card title={title} subtitle="Downloads vs previous period" className="span-6" flush>
      <table className="data compact">
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><AppCell app={r} size={28} /></td>
              <td className="num">{fmtNum(r.downloads)}</td>
              <td className="num"><Delta value={r.downloadsChange} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function Overview() {
  const { filters, meta } = useApp();
  const state = useApi<OverviewData>('/overview');
  const market = filters.country === 'WW' ? 'all tracked markets' : meta?.countries.find((c) => c.code === filters.country)?.name;
  return (
    <>
      <PageHead title="Market overview" subtitle={`Mobile app economy across ${market ?? ''}, last ${filters.days} days vs the ${filters.days} days before.`} />
      <Async state={state}>
        {(d) => (
          <>
            <div className="grid">
              <Stat label="Downloads" value={fmtNum(d.kpis.downloads.value)} change={d.kpis.downloads.change} foot="vs previous period">
                <Sparkline values={bucket(d.downloads)} />
              </Stat>
              <Stat label="Consumer spend" value={fmtMoney(d.kpis.revenue.value)} change={d.kpis.revenue.change} foot="vs previous period">
                <Sparkline values={bucket(d.revenue)} />
              </Stat>
              <Stat label="Daily active users" value={fmtNum(d.kpis.dau.value)} change={d.kpis.dau.change} foot="average per day" />
              <Stat label="Revenue per download" value={fmtMoney(d.kpis.revenue.value / d.kpis.downloads.value)} foot="store revenue ÷ installs" />
            </div>
            <div className="grid">
              <TrendCard className="span-6" title="Downloads" subtitle="Daily installs, all tracked apps" csvName="market-downloads"
                labels={d.dates} format={fmtNum} series={[{ name: 'Downloads', values: d.downloads }]} />
              <TrendCard className="span-6" title="Consumer spend" subtitle="Daily store revenue, all tracked apps" csvName="market-revenue"
                labels={d.dates} format={fmtMoney} series={[{ name: 'Revenue', values: d.revenue, color: SERIES[2] }]} />
            </div>
            <div className="grid">
              <Card className="span-6" title="Downloads by category" subtitle="Share of installs">
                <SegmentBar items={colored(d.byCategory.downloads)} />
              </Card>
              <Card className="span-6" title="Revenue by category" subtitle="Share of consumer spend">
                <SegmentBar items={colored(d.byCategory.revenue)} />
              </Card>
            </div>
            <div className="grid">
              <Card className="span-6" title="Top apps by downloads" tools={<Link className="btn small" to="/apps">All charts</Link>}>
                <BarList format={fmtNum} items={d.topDownloads.map((a) => ({ label: a.name, value: a.downloads, to: `/apps/${a.id}` }))} />
              </Card>
              <Card className="span-6" title="Top apps by revenue" tools={<Link className="btn small" to="/apps">All charts</Link>}>
                <BarList format={fmtMoney} color={SERIES[2]} items={d.topRevenue.map((a) => ({ label: a.name, value: a.revenue, to: `/apps/${a.id}` }))} />
              </Card>
            </div>
            <div className="grid">
              <Movers title="Fastest growing" rows={d.gainers} />
              <Movers title="Fastest declining" rows={d.decliners} />
            </div>
            <div className="grid">
              <Card className="span-6" title="Downloads by market" subtitle="All tracked markets, current platform filter">
                <BarList format={fmtNum} showShare items={[...d.byCountry].sort((a, b) => b.downloads - a.downloads).map((c) => ({ label: c.name, value: c.downloads }))} />
              </Card>
              <Card className="span-6" title="Revenue by market" subtitle="All tracked markets, current platform filter">
                <BarList format={fmtMoney} showShare color={SERIES[2]} items={[...d.byCountry].sort((a, b) => b.revenue - a.revenue).map((c) => ({ label: c.name, value: c.revenue }))} />
              </Card>
            </div>
          </>
        )}
      </Async>
    </>
  );
}
