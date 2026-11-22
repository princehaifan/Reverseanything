import type { GamesOverview } from '../../server/api-types';
import { BarList, TrendCard } from '../components/charts';
import { AppCell, AppIcon, Async, Card, DataTable, Delta, ExportButton, PageHead, Stat, tableCsv, type Column } from '../components/ui';
import { fmtDate, fmtMoney, fmtNum, fmtPct, SERIES } from '../format';
import { useApi } from '../state';
import { Link } from 'react-router-dom';

type Genre = GamesOverview['genres'][number];

export default function Games() {
  const state = useApi<GamesOverview>('/games/overview');
  return (
    <>
      <PageHead title="Gaming" subtitle="Genre-level market size, monetization, retention benchmarks and live operations." />
      <Async state={state}>
        {(d) => {
          // Colour follows the genre (its fixed position in the taxonomy), never its rank.
          const colorOf = (g: string) => SERIES[d.genreNames.indexOf(g as never)];
          const columns: Column<Genre>[] = [
            { key: 'genre', label: 'Genre', render: (r) => <span className="app-cell"><i className="key" style={{ background: colorOf(r.genre) }} /><b style={{ fontWeight: 550 }}>{r.genre}</b></span>, sort: (r) => r.genre, csv: (r) => r.genre },
            { key: 'rev', label: 'Revenue', num: true, render: (r) => fmtMoney(r.revenue), sort: (r) => r.revenue, csv: (r) => Math.round(r.revenue) },
            { key: 'revc', label: 'Change', num: true, render: (r) => <Delta value={r.revenueChange} />, sort: (r) => r.revenueChange, csv: (r) => r.revenueChange },
            { key: 'dl', label: 'Downloads', num: true, render: (r) => fmtNum(r.downloads), sort: (r) => r.downloads, csv: (r) => Math.round(r.downloads) },
            { key: 'dlc', label: 'Change', num: true, render: (r) => <Delta value={r.downloadsChange} />, sort: (r) => r.downloadsChange, csv: (r) => r.downloadsChange },
            { key: 'rpd', label: 'Rev / download', num: true, render: (r) => fmtMoney(r.rpd), sort: (r) => r.rpd, csv: (r) => Number(r.rpd.toFixed(3)) },
            { key: 'arpdau', label: 'ARPDAU', num: true, render: (r) => fmtMoney(r.arpdau), sort: (r) => r.arpdau, csv: (r) => Number(r.arpdau.toFixed(4)) },
            { key: 'd1', label: 'D1', num: true, render: (r) => fmtPct(r.d1, 0), sort: (r) => r.d1, csv: (r) => Number(r.d1.toFixed(3)) },
            { key: 'd7', label: 'D7', num: true, render: (r) => fmtPct(r.d7, 0), sort: (r) => r.d7, csv: (r) => Number(r.d7.toFixed(3)) },
            { key: 'd30', label: 'D30', num: true, render: (r) => fmtPct(r.d30, 0), sort: (r) => r.d30, csv: (r) => Number(r.d30.toFixed(3)) },
            { key: 'conc', label: 'Top 3 share', num: true, render: (r) => fmtPct(r.top3Share, 0), sort: (r) => r.top3Share, csv: (r) => Number(r.top3Share.toFixed(3)) },
            { key: 'top', label: 'Top grossing title', csv: (r) => r.topTitle.name, render: (r) => <Link to={`/apps/${r.topTitle.id}`} className="app-cell"><AppIcon name={r.topTitle.name} hue={r.topTitle.hue} size={22} /><span>{r.topTitle.name}</span></Link> },
          ];
          const byRevenue = [...d.genres].sort((a, b) => b.revenue - a.revenue);
          return (
            <>
              <div className="grid">
                <Stat label="Games revenue" value={fmtMoney(d.kpis.revenue.value)} change={d.kpis.revenue.change} foot="vs previous period" />
                <Stat label="Games downloads" value={fmtNum(d.kpis.downloads.value)} change={d.kpis.downloads.change} foot="vs previous period" />
                <Stat label="Daily active players" value={fmtNum(d.kpis.dau.value)} change={d.kpis.dau.change} foot="average per day" />
                <Stat label="ARPDAU" value={fmtMoney(d.kpis.revenue.value / d.dates.length / d.kpis.dau.value)} foot="revenue per daily active player" />
              </div>
              <div className="grid">
                <TrendCard className="span-8" title="Revenue by genre" subtitle="Daily store revenue, stacked" stacked height={290}
                  csvName="games-revenue-by-genre" labels={d.dates} format={fmtMoney}
                  series={d.genreNames.map((name, i) => ({ name, values: d.revenueByGenre[i] }))} />
                <Card className="span-4" title="Downloads by genre" subtitle="Where the installs go">
                  <BarList format={fmtNum} showShare items={[...d.genres].sort((a, b) => b.downloads - a.downloads).map((g) => ({ label: g.genre, value: g.downloads, color: colorOf(g.genre) }))} />
                </Card>
              </div>
              <div className="grid">
                <Card className="span-12" flush title="Genre benchmarks" subtitle="Market size, unit economics and retention by genre"
                  tools={<ExportButton name="genre-benchmarks" {...tableCsv(columns, byRevenue)} />}>
                  <DataTable columns={columns} rows={byRevenue} rowKey={(r) => r.genre} />
                </Card>
              </div>
              <div className="grid">
                <Card className="span-6" title="Monetization model by genre" subtitle="Revenue-weighted mix of in-app purchases, advertising and subscriptions">
                  <div style={{ display: 'grid', gap: 12 }}>
                    {byRevenue.map((g) => (
                      <div key={g.genre} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, alignItems: 'start' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: '28px' }}>{g.genre}</span>
                        <MixBar iap={g.monetization.iap} ads={g.monetization.ads} sub={g.monetization.subscription} />
                      </div>
                    ))}
                  </div>
                  <div className="legend" style={{ margin: '14px 0 0' }}>
                    {['In-app purchases', 'Advertising', 'Subscriptions'].map((n, i) => <span key={n}><i className="key" style={{ background: SERIES[i] }} />{n}</span>)}
                  </div>
                </Card>
                <Card className="span-6" title="Live operations feed" subtitle="Most recent events detected across tracked games">
                  <div className="events">
                    {d.liveOps.slice(0, 9).map((e) => (
                      <div className="event" key={e.id + e.date}>
                        <time dateTime={e.date}>{fmtDate(e.date)}</time>
                        <span className="grow"><AppCell app={e} size={26} sub={`${e.type} · ${e.genre}`} /></span>
                        <span className="chip" title="Estimated peak uplift in downloads">+{fmtPct(e.uplift, 0)}</span>
                      </div>
                    ))}
                    {!d.liveOps.length && <div className="empty">No events detected in this period.</div>}
                  </div>
                </Card>
              </div>
              <div className="grid">
                <Card className="span-6" title="Top grossing games">
                  <BarList format={fmtMoney} color={SERIES[2]} items={d.topGrossing.map((a) => ({ label: a.name, value: a.revenue, to: `/apps/${a.id}` }))} />
                </Card>
                <Card className="span-6" title="Most downloaded games">
                  <BarList format={fmtNum} items={d.topDownloaded.map((a) => ({ label: a.name, value: a.downloads, to: `/apps/${a.id}` }))} />
                </Card>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}

/** Segment bar without its own legend: the card shows one shared legend for all rows. */
function MixBar({ iap, ads, sub }: { iap: number; ads: number; sub: number }) {
  const parts = [['In-app purchases', iap], ['Advertising', ads], ['Subscriptions', sub]] as const;
  return (
    <div className="segbar" role="img" aria-label={parts.map(([n, v]) => `${n} ${fmtPct(v, 0)}`).join(', ')}>
      {parts.map(([n, v], i) => (
        <div key={n} title={`${n}: ${fmtPct(v)}`} style={{ flex: `${v} 1 0`, background: SERIES[i] }}>{v >= 0.09 ? fmtPct(v, 0) : ''}</div>
      ))}
    </div>
  );
}
