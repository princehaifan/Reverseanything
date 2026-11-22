import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  AD_CHANNELS, AD_FORMATS, APPS, APP_CATEGORIES, COUNTRIES, GENRES, SITES, appById, dayToIso,
  lastCompleteDay,
} from './catalog';
import { adsOverview, audience, creativeGallery, gamesOverview, siteDetail, webOverview } from './domains';
import { LIVE_CHARTS, LIVE_COUNTRIES, liveChart } from './live';
import {
  ACTIVE_PUBLISHERS, appDetail, appRef, compare, overview, parseFilters, publisherDetail, summarize,
  topApps, topPublishers, type Metric,
} from './metrics';

const metricOf = (v: unknown): Metric => (v === 'revenue' || v === 'dau' ? v : 'downloads');
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const limitOf = (v: unknown, fallback: number, max = 200) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
};

export function createApp(opts: { staticDir?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  const api = express.Router();
  const filters = (req: Request) => parseFilters(req.query as Record<string, unknown>);
  const notFound = (res: Response, what: string) => res.status(404).json({ error: `${what} not found` });

  // The dataset only changes when the day rolls over, so responses are cached per URL per day.
  const cache = new Map<string, unknown>();
  let cacheDay = lastCompleteDay();
  api.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/live')) return next();
    if (cacheDay !== lastCompleteDay() || cache.size > 2000) { cache.clear(); cacheDay = lastCompleteDay(); }
    const hit = cache.get(req.originalUrl);
    if (hit !== undefined) return void res.json(hit);
    const send = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode === 200) cache.set(req.originalUrl, body);
      return send(body);
    };
    next();
  });

  api.get('/meta', (_req, res) => {
    const end = lastCompleteDay();
    res.json({
      countries: COUNTRIES.map((c) => ({ code: c.code, name: c.name })),
      categories: APP_CATEGORIES, genres: GENRES, channels: AD_CHANNELS, formats: AD_FORMATS,
      latestDate: dayToIso(end),
      counts: { apps: APPS.length, publishers: ACTIVE_PUBLISHERS.length, sites: SITES.length },
      live: { countries: LIVE_COUNTRIES, charts: LIVE_CHARTS },
    });
  });

  api.get('/overview', (req, res) => { res.json(overview(filters(req))); });

  api.get('/apps/top', (req, res) => {
    res.json(topApps(metricOf(req.query.metric), filters(req), str(req.query.category, 'all'), limitOf(req.query.limit, 50)));
  });
  api.get('/apps/compare', (req, res) => {
    res.json(compare(str(req.query.ids).split(',').filter(Boolean), filters(req)));
  });
  api.get('/apps/batch', (req, res) => {
    const f = filters(req);
    const ids = str(req.query.ids).split(',').slice(0, 100);
    res.json(ids.map((id) => appById.get(id)).filter((a) => !!a).map((a) => summarize(a, f)));
  });
  api.get('/apps/:id', (req, res) => {
    const a = appById.get(req.params.id);
    if (!a) return void notFound(res, 'App');
    res.json(appDetail(a, filters(req)));
  });

  api.get('/publishers/top', (req, res) => {
    res.json(topPublishers(metricOf(req.query.metric), filters(req), str(req.query.kind, 'all'), limitOf(req.query.limit, 50)));
  });
  api.get('/publishers/:id', (req, res) => {
    const p = publisherDetail(req.params.id, filters(req));
    if (!p) return void notFound(res, 'Publisher');
    res.json(p);
  });

  api.get('/ads/overview', (req, res) => { res.json(adsOverview(filters(req), str(req.query.category, 'all'))); });
  api.get('/ads/creatives', (req, res) => {
    const { category, channel, format, appId } = req.query;
    res.json(creativeGallery(
      filters(req),
      { category: str(category, 'all'), channel: str(channel, 'all'), format: str(format, 'all'), appId: str(appId) || undefined },
      limitOf(req.query.limit, 36, 120),
    ));
  });

  api.get('/web/overview', (req, res) => { res.json(webOverview(filters(req), str(req.query.category, 'all'))); });
  api.get('/web/sites/:domain', (req, res) => {
    const s = siteDetail(req.params.domain, filters(req));
    if (!s) return void notFound(res, 'Site');
    res.json(s);
  });

  api.get('/audience/:id', (req, res) => {
    const a = appById.get(req.params.id);
    if (!a) return void notFound(res, 'App');
    res.json(audience(a, filters(req)));
  });

  api.get('/games/overview', (req, res) => { res.json(gamesOverview(filters(req))); });

  api.get('/search', (req, res) => {
    const q = str(req.query.q).trim().toLowerCase();
    if (!q) return void res.json({ apps: [], publishers: [], sites: [] });
    const score = (name: string) => (name.toLowerCase().startsWith(q) ? 0 : name.toLowerCase().includes(q) ? 1 : -1);
    const best = <T,>(items: T[], name: (x: T) => string, n: number) =>
      items.map((x) => ({ x, s: score(name(x)) })).filter((r) => r.s >= 0).sort((a, b) => a.s - b.s).slice(0, n).map((r) => r.x);
    res.json({
      apps: best(APPS, (a) => a.name, 8).map(appRef),
      publishers: best(ACTIVE_PUBLISHERS, (p) => p.name, 4).map((p) => ({ id: p.id, name: p.name })),
      sites: best(SITES, (s) => s.domain, 4).map((s) => ({ domain: s.domain, name: s.name, hue: s.hue })),
    });
  });

  api.get('/live/charts', async (req, res) => {
    res.json(await liveChart(str(req.query.country, 'us'), str(req.query.chart, 'top-free')));
  });

  api.use((_req, res) => { res.status(404).json({ error: 'Unknown endpoint' }); });
  app.use('/api', api);

  const dir = opts.staticDir;
  if (dir && fs.existsSync(path.join(dir, 'index.html'))) {
    app.use(express.static(dir, { maxAge: '1h', index: false }));
    // Single-page app: every other GET falls through to the client router.
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(dir, 'index.html'));
    });
  }
  return app;
}
