import { Link } from 'react-router-dom';
import type { AppSummary } from '../../server/api-types';
import { appColumns } from '../components/columns';
import { AppCell, Async, Card, DataTable, Delta, ExportButton, PageHead, Stat, tableCsv } from '../components/ui';
import { fmtMoney, fmtNum } from '../format';
import { useApi, useApp } from '../state';

const columns = appColumns({ watch: true });
const ALERT_THRESHOLD = 0.1;

export default function Watchlist() {
  const { watchlist } = useApp();
  const state = useApi<AppSummary[]>(watchlist.length ? '/apps/batch' : null, { ids: watchlist.join(',') });

  if (!watchlist.length) {
    return (
      <>
        <PageHead title="Watchlist" subtitle="Track the competitors you care about in one place." />
        <div className="notice">
          <strong>Your watchlist is empty.</strong> Use the star next to any app in <Link to="/apps" style={{ textDecoration: 'underline' }}>App performance</Link>,
          or the Watch button on an app page. The list is saved in this browser.
        </div>
      </>
    );
  }
  return (
    <>
      <PageHead title="Watchlist" subtitle={`${watchlist.length} tracked app${watchlist.length > 1 ? 's' : ''}, saved in this browser.`}>
        {watchlist.length > 1 && <Link className="btn" to={`/compare?ids=${watchlist.slice(0, 4).join(',')}`}>Compare first {Math.min(4, watchlist.length)}</Link>}
      </PageHead>
      <Async state={state}>
        {(rows) => {
          const sum = (k: 'downloads' | 'revenue' | 'dau') => rows.reduce((t, r) => t + r[k], 0);
          const alerts = rows
            .flatMap((r) => ([['Downloads', r.downloadsChange], ['Revenue', r.revenueChange]] as const)
              .filter(([, c]) => c !== null && Math.abs(c) >= ALERT_THRESHOLD)
              .map(([metric, change]) => ({ r, metric, change: change! })))
            .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
          return (
            <>
              <div className="grid">
                <Stat className="span-4" label="Combined downloads" value={fmtNum(sum('downloads'))} />
                <Stat className="span-4" label="Combined revenue" value={fmtMoney(sum('revenue'))} />
                <Stat className="span-4" label="Combined daily active users" value={fmtNum(sum('dau'))} />
              </div>
              <div className="grid">
                <Card className="span-12" title="Alerts" subtitle={`Moves of ${ALERT_THRESHOLD * 100}% or more vs the previous period`}>
                  {alerts.length ? (
                    <div className="events">
                      {alerts.map((a) => (
                        <div className="event" key={a.r.id + a.metric}>
                          <span className="grow"><AppCell app={a.r} size={26} /></span>
                          <span style={{ color: 'var(--text-2)' }}>{a.metric} {a.change > 0 ? 'up' : 'down'}</span>
                          <Delta value={a.change} />
                        </div>
                      ))}
                    </div>
                  ) : <div className="empty">No large moves in this period.</div>}
                </Card>
              </div>
              <div className="grid">
                <Card className="span-12" flush title="Tracked apps" tools={<ExportButton name="watchlist" {...tableCsv(columns, rows)} />}>
                  <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
                </Card>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
