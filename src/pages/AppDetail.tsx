import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AppDetail as Detail, Creative } from '../../server/api-types';
import { BarList, SegmentBar, TrendCard } from '../components/charts';
import { appColumns } from '../components/columns';
import { CreativeTile } from '../components/Creative';
import { AppIcon, Async, Card, DataTable, Seg, Stat, WatchButton } from '../components/ui';
import { fmtDate, fmtDateLong, fmtMoney, fmtNum, fmtPct, FORMATS, METRIC_LABEL, SERIES, type MetricKey } from '../format';
import { useApi } from '../state';

const METRICS = [['downloads', 'Downloads'], ['revenue', 'Revenue'], ['dau', 'Active users']] as const;
const similarColumns = appColumns({ watch: true });

export default function AppDetail() {
  const { id = '' } = useParams();
  const state = useApi<Detail>(`/apps/${id}`);
  const creatives = useApi<Creative[]>('/ads/creatives', { appId: id, limit: 5 });
  const [metric, setMetric] = useState<MetricKey>('downloads');

  return (
    <Async state={state}>
      {(d) => (
        <>
          <div className="crumbs"><Link to="/apps">App performance</Link> / {d.genre ?? d.category}</div>
          <div className="hero">
            <AppIcon name={d.name} hue={d.hue} size={64} />
            <div>
              <h1>{d.name}</h1>
              <div className="sub">
                <Link to={`/publishers/${d.publisherId}`}>{d.publisher}</Link>
                <span className="chip">{d.genre ? `Games · ${d.genre}` : d.category}</span>
                <span className="chip">{d.platforms.map((p) => (p === 'ios' ? 'iOS' : 'Android')).join(' + ')}</span>
                <span><span className="stars">★</span> {d.rating.toFixed(1)} ({fmtNum(d.ratingCount)})</span>
                <span>Launched {fmtDateLong(d.launchDate)}</span>
                {d.website && <Link to={`/web/${d.website}`}>{d.website}</Link>}
              </div>
            </div>
            <div className="page-tools">
              <WatchButton id={d.id} label />
              <Link className="btn" to={`/audience?app=${d.id}`}>Audience</Link>
              <Link className="btn" to={`/compare?ids=${d.id}`}>Compare</Link>
            </div>
          </div>

          <div className="grid">
            <Stat label="Downloads" value={fmtNum(d.downloads)} change={d.downloadsChange} foot="vs previous period" />
            <Stat label="Revenue" value={fmtMoney(d.revenue)} change={d.revenueChange} foot="vs previous period" />
            <Stat label="Daily active users" value={fmtNum(d.dau)} change={d.dauChange} foot={`${fmtNum(d.engagement.mau)} monthly`} />
            <Stat label="Revenue per download" value={fmtMoney(d.rpd)} foot={`${fmtPct(d.engagement.stickiness, 0)} DAU/MAU`} />
          </div>

          <div className="grid">
            <TrendCard className="span-8" title={METRIC_LABEL[metric]} subtitle="Daily, for the selected market and platform"
              csvName={`${d.id}-${metric}`} labels={d.dates} format={FORMATS[metric]} height={270}
              series={[{ name: METRIC_LABEL[metric], values: d.series[metric] }]}
              tools={<Seg label="Metric" value={metric} onChange={setMetric} options={METRICS} />} />
            <Card className="span-4" title="Detected events" subtitle="Spikes attributed to launches and campaigns">
              {d.events.length ? (
                <div className="events">
                  {[...d.events].reverse().slice(0, 7).map((e) => (
                    <div className="event" key={e.date}>
                      <time dateTime={e.date}>{fmtDate(e.date)}</time>
                      <span className="grow">{e.type}</span>
                      <span className="chip" title="Estimated peak uplift in downloads">+{fmtPct(e.uplift, 0)}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="empty">No notable events in this period.</div>}
            </Card>
          </div>

          <div className="grid">
            <TrendCard className="span-6" title={`Rank in ${d.genre ?? d.category}`}
              subtitle={`Daily position by downloads among ${d.rankPeers} tracked ${d.genre ?? d.category} titles (1 is best)`}
              csvName={`${d.id}-rank`} labels={d.dates} format={(n) => `#${Math.round(n)}`} reversed integerTicks
              series={[{ name: 'Rank', values: d.rankSeries, color: SERIES[6] }]} />
            <TrendCard className="span-6" title="Retention" subtitle={`Share of new users still active, vs the ${d.genre ?? d.category} average`}
              csvName={`${d.id}-retention`} xLabel="Day" labels={d.retention.map((r) => `D${r.day}`)} format={(n) => fmtPct(n, 0)}
              series={[
                { name: d.name, values: d.retention.map((r) => r.value) },
                { name: `${d.genre ?? d.category} average`, values: d.retentionBenchmark.map((r) => r.value), color: 'var(--other)' },
              ]} />
          </div>

          <div className="grid">
            <Card className="span-6" title="Downloads by market" subtitle="All tracked markets">
              <BarList format={fmtNum} showShare items={[...d.countries].sort((a, b) => b.downloads - a.downloads).slice(0, 8).map((c) => ({ label: c.name, value: c.downloads }))} />
            </Card>
            <Card className="span-6" title="Revenue by market" subtitle="All tracked markets">
              <BarList format={fmtMoney} showShare color={SERIES[2]} items={[...d.countries].sort((a, b) => b.revenue - a.revenue).slice(0, 8).map((c) => ({ label: c.name, value: c.revenue }))} />
            </Card>
          </div>

          <div className="grid">
            <Card className="span-4" title="Monetization mix" subtitle="Estimated share of total revenue">
              <SegmentBar items={d.monetization.map((m, i) => ({ ...m, color: SERIES[i] }))} />
              <h2 style={{ fontSize: 14, margin: '20px 0 2px' }}>Platform split</h2>
              <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 8 }}>Downloads, then revenue</p>
              <div style={{ display: 'grid', gap: 12 }}>
                {[d.platformSplit.downloadsIos, d.platformSplit.revenueIos].map((ios, i) => (
                  <SegmentBar key={i} items={[{ name: 'iOS', value: ios, color: SERIES[0] }, { name: 'Android', value: 1 - ios, color: SERIES[2] }]} />
                ))}
              </div>
            </Card>
            <Card className="span-4" title="Ratings" subtitle={`${d.rating.toFixed(2)} average from ${fmtNum(d.ratingCount)} ratings`}>
              <BarList format={(n) => fmtPct(n, 0)} color={SERIES[3]}
                items={[...d.ratingHistogram].reverse().map((r) => ({ label: `${r.stars} star${r.stars > 1 ? 's' : ''}`, value: r.share }))} />
            </Card>
            <Card className="span-4" title="Engagement" subtitle="Modelled usage per active user">
              <dl className="kv">
                <dt>Monthly active users</dt><dd>{fmtNum(d.engagement.mau)}</dd>
                <dt>Stickiness (DAU / MAU)</dt><dd>{fmtPct(d.engagement.stickiness)}</dd>
                <dt>Sessions per user per day</dt><dd>{d.engagement.sessions.toFixed(1)}</dd>
                <dt>Minutes per session</dt><dd>{d.engagement.minutes.toFixed(1)}</dd>
                <dt>Day 1 retention</dt><dd>{fmtPct(d.retention[0].value)}</dd>
                <dt>Day 7 retention</dt><dd>{fmtPct(d.retention[4].value)}</dd>
                <dt>Day 30 retention</dt><dd>{fmtPct(d.retention[8].value)}</dd>
              </dl>
            </Card>
          </div>

          {!!creatives.data?.length && (
            <div className="grid">
              <Card className="span-12" title="Top ad creatives" subtitle="Highest-impression creatives running in this period"
                tools={<Link className="btn small" to="/ads">Ad intelligence</Link>}>
                <div className="creatives">{creatives.data.map((c) => <CreativeTile key={c.id} c={c} />)}</div>
              </Card>
            </div>
          )}

          <div className="grid">
            <Card className="span-12" flush title="Closest competitors" subtitle={`Similar-sized ${d.genre ?? d.category} titles`}
              tools={<Link className="btn small" to={`/compare?ids=${[d.id, ...d.similar.slice(0, 3).map((s) => s.id)].join(',')}`}>Compare these</Link>}>
              <DataTable columns={similarColumns} rows={d.similar} rowKey={(r) => r.id} />
            </Card>
          </div>
        </>
      )}
    </Async>
  );
}
