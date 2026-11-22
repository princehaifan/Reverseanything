// Time-series model and the app / publisher aggregations built on top of it.
import {
  APPS, AGE_BANDS, COUNTRIES, PROFILES, PUBLISHERS, REF_DAY, appById, countryIndex, dayToIso,
  lastCompleteDay, publisherById, siteByApp, type App,
} from './catalog';
import { between, gauss, rand } from './rng';

export type Metric = 'downloads' | 'revenue' | 'dau';
export type Platform = 'all' | 'ios' | 'android';
export interface Filters { country: string; platform: Platform; days: number; end: number }

export const EVENT_TYPES = ['Store feature', 'Major update', 'UA burst', 'Live event'] as const;
const WINDOW = 21;

export interface AppEvent { day: number; type: string; magnitude: number }

function eventInWindow(app: App, w: number): AppEvent | null {
  if (rand('ev', app.id, w) >= 0.24) return null;
  const types = app.category === 'Games' ? EVENT_TYPES : EVENT_TYPES.slice(0, 3);
  return {
    day: w * WINDOW + Math.floor(rand('evday', app.id, w) * WINDOW),
    type: types[Math.floor(rand('evtype', app.id, w) * types.length)],
    magnitude: between(0.25, 1.4, 'evmag', app.id, w),
  };
}

/** Decaying uplift from recent events (0 when nothing is happening). */
function spike(app: App, day: number): number {
  const w = Math.floor(day / WINDOW);
  let s = 0;
  for (const k of [w - 1, w]) {
    const e = eventInWindow(app, k);
    if (e && day >= e.day && e.day >= app.launchDay) s += e.magnitude * Math.exp(-(day - e.day) / 5);
  }
  return s;
}

export function eventsBetween(app: App, from: number, to: number): AppEvent[] {
  const out: AppEvent[] = [];
  for (let w = Math.floor(from / WINDOW); w <= Math.floor(to / WINDOW); w++) {
    const e = eventInWindow(app, w);
    if (e && e.day >= from && e.day <= to && e.day >= app.launchDay) out.push(e);
  }
  return out;
}

function level(app: App, day: number): number {
  if (day < app.launchDay) return 0;
  const ramp = Math.min(1, 0.15 + (day - app.launchDay) / 45);
  return ramp * Math.exp((app.growth * (day - REF_DAY)) / 365);
}

const weekday = (day: number) => (((day + 4) % 7) + 7) % 7; // 0 = Sunday
function weekly(app: App, day: number, strength = 1): number {
  const dow = weekday(day);
  const isWeekend = dow === 0 || dow === 6;
  const w = PROFILES[app.segment].weekend * strength;
  return isWeekend ? 1 + w : 1 - w * 0.4;
}
/** Year-end holiday bump. */
function seasonal(day: number): number {
  const d = new Date(day * 86_400_000);
  const doy = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000;
  const dist = Math.min(Math.abs(doy - 359), 365 - Math.abs(doy - 359));
  return 1 + 0.16 * Math.exp(-(dist * dist) / 160);
}

const memo = new Map<string, Map<number, number>>();

/** Worldwide, all-platform value of one metric for one app on one day. */
export function daily(app: App, metric: Metric, day: number): number {
  let m = memo.get(app.id + metric);
  if (!m) memo.set(app.id + metric, (m = new Map()));
  const hit = m.get(day);
  if (hit !== undefined) return hit;
  const lv = level(app, day);
  let v = 0;
  if (lv > 0) {
    const s = spike(app, day);
    if (metric === 'downloads') {
      v = app.baseDownloads * lv * weekly(app, day) * seasonal(day) * (1 + s) * Math.exp(0.08 * gauss('n', app.id, 'd', day));
    } else if (metric === 'revenue') {
      v = app.baseRevenue * Math.pow(lv, 0.85) * weekly(app, day, 0.7) * seasonal(day) * (1 + 0.55 * s) * Math.exp(0.07 * gauss('n', app.id, 'r', day));
    } else {
      v = app.baseDau * Math.pow(lv, 0.9) * weekly(app, day, 0.35) * (1 + 0.22 * s) * Math.exp(0.025 * gauss('n', app.id, 'a', day));
    }
  }
  m.set(day, v);
  return v;
}

/** Share of the worldwide figure that falls inside a country / platform slice. */
export function share(app: App, metric: Metric, country: string, platform: Platform): number {
  let s = 1;
  const ci = countryIndex.get(country);
  if (ci !== undefined) s *= (metric === 'revenue' ? app.revShares : app.dlShares)[ci];
  if (platform !== 'all') {
    const ios = metric === 'revenue' ? app.iosRevShare : app.iosShare;
    s *= platform === 'ios' ? ios : 1 - ios;
  }
  return s;
}

export function total(app: App, metric: Metric, from: number, to: number): number {
  let t = 0;
  for (let d = from; d <= to; d++) t += daily(app, metric, d);
  return metric === 'dau' ? t / (to - from + 1) : t; // DAU is an average, not a sum
}

export const pct = (cur: number, prev: number): number | null =>
  prev > 0 ? (cur - prev) / prev : null;

export function parseFilters(q: Record<string, unknown>, end = lastCompleteDay()): Filters {
  const country = typeof q.country === 'string' && countryIndex.has(q.country) ? q.country : 'WW';
  const platform = q.platform === 'ios' || q.platform === 'android' ? q.platform : 'all';
  const n = Number(q.days);
  const days = [7, 30, 90, 180, 365].includes(n) ? n : 30;
  return { country, platform, days, end };
}

export const range = (f: Filters) => ({
  from: f.end - f.days + 1, to: f.end, prevFrom: f.end - 2 * f.days + 1, prevTo: f.end - f.days,
});

export function appRef(app: App) {
  return {
    id: app.id, name: app.name, hue: app.hue, category: app.category, genre: app.genre,
    publisherId: app.publisherId, publisher: publisherById.get(app.publisherId)!.name,
  };
}

export function summarize(app: App, f: Filters) {
  const r = range(f);
  const m = (metric: Metric) => {
    const s = share(app, metric, f.country, f.platform);
    const cur = total(app, metric, r.from, r.to) * s;
    const prev = total(app, metric, r.prevFrom, r.prevTo) * s;
    return { cur, prev, change: pct(cur, prev) };
  };
  const d = m('downloads'), rev = m('revenue'), a = m('dau');
  return {
    ...appRef(app),
    downloads: d.cur, downloadsPrev: d.prev, downloadsChange: d.change,
    revenue: rev.cur, revenuePrev: rev.prev, revenueChange: rev.change,
    dau: a.cur, dauPrev: a.prev, dauChange: a.change,
    rpd: d.cur > 0 ? rev.cur / d.cur : 0,
  };
}
export type AppSummary = ReturnType<typeof summarize>;

export function matchesCategory(app: App, category: string): boolean {
  if (!category || category === 'all') return true;
  if (category === 'apps') return app.category !== 'Games';
  return app.category === category || app.genre === category;
}

export function topApps(metric: Metric, f: Filters, category = 'all', limit = 50) {
  const rows = APPS.filter((a) => matchesCategory(a, category)).map((a) => summarize(a, f));
  const prevKey = `${metric}Prev` as const;
  const prevRank = new Map(
    [...rows].sort((a, b) => b[prevKey] - a[prevKey]).map((r, i) => [r.id, i + 1]),
  );
  return rows
    .filter((r) => r[metric] > 0)
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, limit)
    .map((r, i) => {
      const before = r[prevKey] > 0 ? prevRank.get(r.id)! : null;
      return { ...r, rank: i + 1, rankChange: before === null ? null : before - (i + 1) };
    });
}

/** Daily series summed over a set of apps, under the active filters. */
export function seriesFor(apps: App[], metric: Metric, f: Filters, from = f.end - f.days + 1): number[] {
  const shares = apps.map((a) => share(a, metric, f.country, f.platform));
  const out: number[] = [];
  for (let d = from; d <= f.end; d++) {
    let t = 0;
    for (let i = 0; i < apps.length; i++) t += daily(apps[i], metric, d) * shares[i];
    out.push(t);
  }
  return out;
}
export const dates = (f: Filters) =>
  Array.from({ length: f.days }, (_, i) => dayToIso(f.end - f.days + 1 + i));

function sumMetric(apps: App[], metric: Metric, f: Filters) {
  const r = range(f);
  let cur = 0, prev = 0;
  for (const a of apps) {
    const s = share(a, metric, f.country, f.platform);
    cur += total(a, metric, r.from, r.to) * s;
    prev += total(a, metric, r.prevFrom, r.prevTo) * s;
  }
  return { value: cur, change: pct(cur, prev) };
}
export const kpis = (apps: App[], f: Filters) => ({
  downloads: sumMetric(apps, 'downloads', f),
  revenue: sumMetric(apps, 'revenue', f),
  dau: sumMetric(apps, 'dau', f),
});

/** Group a per-app value by a key, keeping the top `keep` groups and folding the rest. */
export function groupTop<T>(rows: T[], key: (r: T) => string, value: (r: T) => number, keep = 7) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + value(r));
  const sorted = [...m].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, keep).map(([name, v]) => ({ name, value: v }));
  const rest = sorted.slice(keep).reduce((t, [, v]) => t + v, 0);
  if (rest > 0) head.push({ name: 'Other', value: rest });
  return head;
}

export function overview(f: Filters) {
  const rows = APPS.map((a) => summarize(a, f));
  const floor = [...rows].sort((a, b) => b.downloads - a.downloads)[Math.floor(rows.length * 0.6)].downloads;
  const movers = rows.filter((r) => r.downloadsChange !== null && r.downloadsPrev > floor);
  const byChange = [...movers].sort((a, b) => b.downloadsChange! - a.downloadsChange!);
  const r = range(f);
  return {
    kpis: kpis(APPS, f),
    dates: dates(f),
    downloads: seriesFor(APPS, 'downloads', f),
    revenue: seriesFor(APPS, 'revenue', f),
    byCategory: {
      downloads: groupTop(rows, (x) => x.category, (x) => x.downloads),
      revenue: groupTop(rows, (x) => x.category, (x) => x.revenue),
    },
    byCountry: COUNTRIES.map((c) => {
      const cf = { ...f, country: c.code };
      let downloads = 0, revenue = 0;
      for (const a of APPS) {
        downloads += total(a, 'downloads', r.from, r.to) * share(a, 'downloads', c.code, cf.platform);
        revenue += total(a, 'revenue', r.from, r.to) * share(a, 'revenue', c.code, cf.platform);
      }
      return { code: c.code, name: c.name, downloads, revenue };
    }),
    gainers: byChange.slice(0, 6),
    decliners: byChange.slice(-6).reverse(),
    topDownloads: topApps('downloads', f, 'all', 8),
    topRevenue: topApps('revenue', f, 'all', 8),
  };
}

/** Retention curve through the model's D1 / D7 / D30 anchors. */
export function retentionCurve(d1: number, d7: number, d30: number) {
  const anchors: [number, number][] = [[1, d1], [7, d7], [30, d30]];
  const at = (day: number) => {
    const [a, b] = day <= 7 ? [anchors[0], anchors[1]] : [anchors[1], anchors[2]];
    const k = Math.log(b[1] / a[1]) / Math.log(b[0] / a[0]);
    return a[1] * Math.pow(day / a[0], k);
  };
  return [1, 2, 3, 5, 7, 10, 14, 21, 30].map((day) => ({ day, value: at(day) }));
}

export function segmentBenchmark(segment: string) {
  const peers = APPS.filter((a) => a.segment === segment);
  const avg = (fn: (a: App) => number) => peers.reduce((t, a) => t + fn(a), 0) / peers.length;
  return {
    d1: avg((a) => a.d1), d7: avg((a) => a.d7), d30: avg((a) => a.d30),
    female: avg((a) => a.female),
    ages: AGE_BANDS.map((_, i) => avg((a) => a.ageWeights[i])),
  };
}

function ratingHistogram(app: App) {
  const mean = app.rating;
  const w = [1, 2, 3, 4, 5].map((s) => Math.exp(-Math.pow(s - mean - 0.6, 2) / 1.6) + (s === 1 ? 0.08 : 0));
  const t = w.reduce((a, b) => a + b, 0);
  return w.map((x, i) => ({ stars: i + 1, share: x / t }));
}

export function appDetail(app: App, f: Filters) {
  const r = range(f);
  const peers = APPS.filter((a) => a.segment === app.segment);
  const rankSeries: (number | null)[] = [];
  const s = share(app, 'downloads', f.country, f.platform);
  const peerShares = peers.map((p) => share(p, 'downloads', f.country, f.platform));
  for (let d = r.from; d <= r.to; d++) {
    const mine = daily(app, 'downloads', d) * s;
    if (mine <= 0) { rankSeries.push(null); continue; }
    let rank = 1;
    peers.forEach((p, i) => { if (p !== app && daily(p, 'downloads', d) * peerShares[i] > mine) rank++; });
    rankSeries.push(rank);
  }
  const site = siteByApp.get(app.id);
  const bench = segmentBenchmark(app.segment);
  const p = PROFILES[app.segment];
  const dau = total(app, 'dau', r.from, r.to);
  return {
    ...summarize(app, f),
    platforms: app.platforms,
    launchDate: dayToIso(app.launchDay),
    publisherCountry: publisherById.get(app.publisherId)!.country,
    website: site?.domain ?? null,
    rating: app.rating, ratingCount: app.ratingCount, ratingHistogram: ratingHistogram(app),
    dates: dates(f),
    series: {
      downloads: seriesFor([app], 'downloads', f),
      revenue: seriesFor([app], 'revenue', f),
      dau: seriesFor([app], 'dau', f),
    },
    rankSeries, rankPeers: peers.length,
    events: eventsBetween(app, r.from, r.to).map((e) => ({ date: dayToIso(e.day), type: e.type, uplift: e.magnitude })),
    countries: COUNTRIES.map((c, i) => ({
      code: c.code, name: c.name,
      downloads: total(app, 'downloads', r.from, r.to) * app.dlShares[i] * share(app, 'downloads', 'WW', f.platform),
      revenue: total(app, 'revenue', r.from, r.to) * app.revShares[i] * share(app, 'revenue', 'WW', f.platform),
    })),
    platformSplit: { downloadsIos: app.iosShare, revenueIos: app.iosRevShare },
    monetization: [
      { name: 'In-app purchases', value: app.monet[0] },
      { name: 'Advertising', value: app.monet[1] },
      { name: 'Subscriptions', value: app.monet[2] },
    ],
    retention: retentionCurve(app.d1, app.d7, app.d30),
    retentionBenchmark: retentionCurve(bench.d1, bench.d7, bench.d30),
    engagement: {
      mau: dau / stickiness(app), stickiness: stickiness(app),
      sessions: p.sessions * Math.exp(0.2 * gauss('sess', app.id)),
      minutes: p.minutes * Math.exp(0.25 * gauss('mins', app.id)),
    },
    similar: peers
      .filter((x) => x !== app)
      .sort((a, b) => Math.abs(Math.log(a.baseDownloads / app.baseDownloads)) - Math.abs(Math.log(b.baseDownloads / app.baseDownloads)))
      .slice(0, 5)
      .map((x) => summarize(x, f)),
  };
}

/** DAU / MAU ratio, derived from how well the app retains users. */
export const stickiness = (app: App) => Math.min(0.72, 0.08 + app.d30 * 1.6 + app.d7 * 0.25);

export function compare(ids: string[], f: Filters) {
  const apps = ids.map((id) => appById.get(id)).filter((a): a is App => !!a).slice(0, 4);
  return {
    dates: dates(f),
    apps: apps.map((a) => ({
      ...summarize(a, f),
      rating: a.rating, d1: a.d1, d7: a.d7, d30: a.d30, stickiness: stickiness(a),
      series: {
        downloads: seriesFor([a], 'downloads', f),
        revenue: seriesFor([a], 'revenue', f),
        dau: seriesFor([a], 'dau', f),
      },
    })),
  };
}

const appsOf = (publisherId: string) => APPS.filter((a) => a.publisherId === publisherId);
export const ACTIVE_PUBLISHERS = PUBLISHERS.filter((p) => appsOf(p.id).length > 0);

export function topPublishers(metric: Metric, f: Filters, kind = 'all', limit = 50) {
  return ACTIVE_PUBLISHERS
    .filter((p) => kind === 'all' || (kind === 'Games') === p.games)
    .map((p) => {
      const apps = appsOf(p.id);
      const k = kpis(apps, f);
      const top = apps.map((a) => summarize(a, f)).sort((a, b) => b[metric] - a[metric])[0];
      return {
        id: p.id, name: p.name, country: p.country, kind: p.games ? 'Games' : 'Apps', apps: apps.length,
        downloads: k.downloads.value, downloadsChange: k.downloads.change,
        revenue: k.revenue.value, revenueChange: k.revenue.change,
        dau: k.dau.value, dauChange: k.dau.change,
        topApp: { id: top.id, name: top.name, hue: top.hue },
      };
    })
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, limit)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function publisherDetail(id: string, f: Filters) {
  const p = publisherById.get(id);
  if (!p) return null;
  const apps = appsOf(id);
  const rows = apps.map((a) => summarize(a, f)).sort((a, b) => b.revenue - a.revenue);
  return {
    id: p.id, name: p.name, country: p.country, kind: p.games ? 'Games' : 'Apps',
    kpis: kpis(apps, f), dates: dates(f),
    downloads: seriesFor(apps, 'downloads', f), revenue: seriesFor(apps, 'revenue', f),
    apps: rows,
    revenueByApp: groupTop(rows, (x) => x.name, (x) => x.revenue, 5),
  };
}
