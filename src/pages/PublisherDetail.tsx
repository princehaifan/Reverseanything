import { Link, useParams } from 'react-router-dom';
import type { PublisherDetail as Detail } from '../../server/api-types';
import { SegmentBar, TrendCard } from '../components/charts';
import { appColumns } from '../components/columns';
import { Async, Card, DataTable, ExportButton, Stat, tableCsv } from '../components/ui';
import { fmtMoney, fmtNum, OTHER_COLOR, SERIES } from '../format';
import { useApi } from '../state';

const columns = appColumns({ watch: true });

export default function PublisherDetail() {
  const { id = '' } = useParams();
  const state = useApi<Detail>(`/publishers/${id}`);
  return (
    <Async state={state}>
      {(d) => (
        <>
          <div className="crumbs"><Link to="/apps">App performance</Link> / Publishers</div>
          <div className="hero">
            <div>
              <h1>{d.name}</h1>
              <div className="sub"><span className="chip">{d.kind} publisher</span><span>Headquartered in {d.country}</span><span>{d.apps.length} tracked apps</span></div>
            </div>
          </div>
          <div className="grid">
            <Stat label="Downloads" value={fmtNum(d.kpis.downloads.value)} change={d.kpis.downloads.change} foot="vs previous period" />
            <Stat label="Revenue" value={fmtMoney(d.kpis.revenue.value)} change={d.kpis.revenue.change} foot="vs previous period" />
            <Stat label="Daily active users" value={fmtNum(d.kpis.dau.value)} change={d.kpis.dau.change} foot="sum across portfolio" />
            <Stat label="Revenue per download" value={fmtMoney(d.kpis.downloads.value ? d.kpis.revenue.value / d.kpis.downloads.value : 0)} />
          </div>
          <div className="grid">
            <TrendCard className="span-6" title="Portfolio downloads" csvName={`${d.id}-downloads`} labels={d.dates} format={fmtNum}
              series={[{ name: 'Downloads', values: d.downloads }]} />
            <TrendCard className="span-6" title="Portfolio revenue" csvName={`${d.id}-revenue`} labels={d.dates} format={fmtMoney}
              series={[{ name: 'Revenue', values: d.revenue, color: SERIES[2] }]} />
          </div>
          <div className="grid">
            <Card className="span-12" title="Revenue concentration" subtitle="Share of portfolio revenue by app">
              <SegmentBar items={d.revenueByApp.map((x, i) => ({ ...x, color: x.name === 'Other' ? OTHER_COLOR : SERIES[i] }))} />
            </Card>
          </div>
          <div className="grid">
            <Card className="span-12" flush title="Portfolio" tools={<ExportButton name={`${d.id}-portfolio`} {...tableCsv(columns, d.apps)} />}>
              <DataTable columns={columns} rows={d.apps} rowKey={(r) => r.id} />
            </Card>
          </div>
        </>
      )}
    </Async>
  );
}
