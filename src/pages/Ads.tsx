import { useState } from 'react';
import type { AdsOverview, Creative } from '../../server/api-types';
import { BarList, SegmentBar, TrendCard } from '../components/charts';
import { CreativeTile } from '../components/Creative';
import { AppCell, Async, Card, DataTable, Delta, ExportButton, PageHead, Select, Stat, tableCsv, type Column } from '../components/ui';
import { fmtMoney, fmtNum, fmtPct, OTHER_COLOR, SERIES } from '../format';
import { useApi, useApp } from '../state';

type Advertiser = AdsOverview['advertisers'][number];
const columns: Column<Advertiser>[] = [
  { key: 'rank', label: '#', className: 'rank', render: (r) => r.rank, csv: (r) => r.rank },
  { key: 'app', label: 'Advertiser', render: (r) => <AppCell app={r} />, sort: (r) => r.name.toLowerCase(), csv: (r) => r.name },
  { key: 'cat', label: 'Category', render: (r) => <span className="chip">{r.genre ?? r.category}</span>, csv: (r) => r.genre ?? r.category },
  { key: 'spend', label: 'Est. spend', num: true, render: (r) => fmtMoney(r.spend), sort: (r) => r.spend, csv: (r) => Math.round(r.spend) },
  { key: 'chg', label: 'Change', num: true, render: (r) => <Delta value={r.spendChange} />, sort: (r) => r.spendChange, csv: (r) => r.spendChange },
  { key: 'sov', label: 'Share of voice', num: true, render: (r) => fmtPct(r.shareOfVoice), sort: (r) => r.shareOfVoice, csv: (r) => Number(r.shareOfVoice.toFixed(4)) },
  { key: 'paid', label: 'Paid installs', num: true, render: (r) => fmtPct(r.paidShare, 0), sort: (r) => r.paidShare, csv: (r) => Number(r.paidShare.toFixed(3)) },
  { key: 'cpi', label: 'Est. CPI', num: true, render: (r) => fmtMoney(r.cpi), sort: (r) => r.cpi, csv: (r) => Number(r.cpi.toFixed(2)) },
  { key: 'top', label: 'Top channel', render: (r) => r.topChannel, sort: (r) => r.topChannel, csv: (r) => r.topChannel },
  { key: 'cr', label: 'Live creatives', num: true, render: (r) => r.creatives, sort: (r) => r.creatives, csv: (r) => r.creatives },
];

export default function Ads() {
  const { meta } = useApp();
  const [category, setCategory] = useState('all');
  const [channel, setChannel] = useState('all');
  const [format, setFormat] = useState('all');
  const state = useApi<AdsOverview>('/ads/overview', { category });
  const creatives = useApi<Creative[]>('/ads/creatives', { category, channel, format, limit: 24 });

  return (
    <>
      <PageHead title="Ad intelligence" subtitle="Estimated user-acquisition spend, share of voice by channel, and the creatives behind it.">
        <Select label="Category" value={category} onChange={setCategory} options={[
          ['all', 'All advertisers'], ['Games', 'All games'], ['apps', 'All non-game apps'],
          { group: 'Game genres', items: (meta?.genres ?? []).map((g) => [g, g] as const) },
          { group: 'App categories', items: (meta?.categories ?? []).map((c) => [c, c] as const) },
        ]} />
      </PageHead>
      <Async state={state}>
        {(d) => (
          <>
            <div className="grid">
              <Stat label="Estimated ad spend" value={fmtMoney(d.kpis.spend.value)} change={d.kpis.spend.change} foot="vs previous period" />
              <Stat label="Active advertisers" value={fmtNum(d.kpis.advertisers)} foot="apps with paid installs" />
              <Stat label="Live creatives" value={fmtNum(d.kpis.creatives)} foot="running in this period" />
              <Stat label="Average cost per install" value={fmtMoney(d.kpis.avgCpi)} foot="spend ÷ paid installs" />
            </div>
            <div className="grid">
              <TrendCard className="span-8" title="Spend by channel" subtitle="Daily estimated spend, stacked" stacked height={280}
                csvName="ad-spend-by-channel" labels={d.dates} format={fmtMoney}
                series={d.channels.map((name, i) => ({ name, values: d.spendByChannel[i] }))} />
              <Card className="span-4" title="Share of voice" subtitle="Share of spend by channel">
                <BarList format={fmtMoney} showShare items={d.channelTotals.map((c, i) => ({ label: c.name, value: c.value, color: SERIES[i] }))} />
              </Card>
            </div>
            <div className="grid">
              <Card className="span-6" title="Creative format mix" subtitle="Share of spend by format">
                <SegmentBar items={d.formatTotals.map((f, i) => ({ ...f, color: SERIES[i] }))} />
              </Card>
              <Card className="span-6" title="Spend by category" subtitle="Where the advertising budget comes from">
                <SegmentBar items={d.bySegment.map((s, i) => ({ ...s, color: s.name === 'Other' ? OTHER_COLOR : SERIES[i] }))} />
              </Card>
            </div>
            <div className="grid">
              <Card className="span-12" flush title="Top advertisers" subtitle="Ranked by estimated spend"
                tools={<ExportButton name="top-advertisers" {...tableCsv(columns, d.advertisers)} />}>
                <DataTable columns={columns} rows={d.advertisers} rowKey={(r) => r.id} />
              </Card>
            </div>
          </>
        )}
      </Async>
      <div className="grid">
        <Card className="span-12" title="Creative gallery" subtitle="Top creatives by impressions. Artwork is a placeholder rendering."
          tools={<>
            <Select label="Channel" value={channel} onChange={setChannel} options={[['all', 'All channels'], ...(meta?.channels ?? []).map((c) => [c, c] as const)]} />
            <Select label="Format" value={format} onChange={setFormat} options={[['all', 'All formats'], ...(meta?.formats ?? []).map((c) => [c, c] as const)]} />
          </>}>
          <Async state={creatives}>
            {(list) => list.length
              ? <div className="creatives">{list.map((c) => <CreativeTile key={c.id} c={c} />)}</div>
              : <div className="empty">No creatives match these filters.</div>}
          </Async>
        </Card>
      </div>
    </>
  );
}
