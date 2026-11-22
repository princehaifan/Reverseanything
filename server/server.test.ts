import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { APPS, COUNTRIES, PUBLISHERS, REF_DAY, SITES } from './catalog';
import { adsOverview, audience, gamesOverview, webOverview } from './domains';
import { liveChart, parseFeed } from './live';
import { daily, overview, parseFilters, share, summarize, topApps, type Filters } from './metrics';

const f: Filters = { country: 'WW', platform: 'all', days: 30, end: REF_DAY + 200 };
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('catalog', () => {
  it('has unique ids and valid references', () => {
    expect(new Set(APPS.map((a) => a.id)).size).toBe(APPS.length);
    expect(new Set(SITES.map((s) => s.domain)).size).toBe(SITES.length);
    const pubs = new Set(PUBLISHERS.map((p) => p.id));
    for (const a of APPS) expect(pubs.has(a.publisherId)).toBe(true);
    for (const s of SITES) expect(s.domain.endsWith('.example')).toBe(true);
  });
  it('keeps every mix normalised', () => {
    for (const a of APPS) {
      for (const mix of [a.dlShares, a.revShares, a.monet, a.ageWeights, a.channelMix, a.formatMix]) {
        expect(sum(mix)).toBeCloseTo(1, 6);
      }
    }
  });
});

describe('metrics', () => {
  it('is deterministic and non-negative', () => {
    const a = APPS[0];
    expect(daily(a, 'downloads', REF_DAY)).toBe(daily(a, 'downloads', REF_DAY));
    for (const app of APPS) expect(daily(app, 'revenue', REF_DAY + 50)).toBeGreaterThanOrEqual(0);
    expect(daily(a, 'downloads', a.launchDay - 1)).toBe(0);
  });
  it('splits worldwide totals exactly across countries and platforms', () => {
    for (const a of APPS.slice(0, 20)) {
      expect(sum(COUNTRIES.map((c) => share(a, 'revenue', c.code, 'all')))).toBeCloseTo(1, 6);
      expect(share(a, 'downloads', 'US', 'ios') + share(a, 'downloads', 'US', 'android')).toBeCloseTo(share(a, 'downloads', 'US', 'all'), 9);
    }
  });
  it('ranks top charts in descending order with consistent ranks', () => {
    const rows = topApps('revenue', f, 'Games', 25);
    expect(rows).toHaveLength(25);
    rows.forEach((r, i) => {
      expect(r.rank).toBe(i + 1);
      expect(r.category).toBe('Games');
      if (i) expect(rows[i - 1].revenue).toBeGreaterThanOrEqual(r.revenue);
    });
  });
  it('makes the overview agree with the sum of its parts', () => {
    const o = overview(f);
    expect(sum(o.downloads)).toBeCloseTo(o.kpis.downloads.value, 3);
    expect(sum(o.byCategory.revenue.map((c) => c.value))).toBeCloseTo(o.kpis.revenue.value, 3);
    expect(sum(o.byCountry.map((c) => c.downloads))).toBeCloseTo(o.kpis.downloads.value, 3);
    expect(sum(APPS.map((a) => summarize(a, f).revenue))).toBeCloseTo(o.kpis.revenue.value, 3);
  });
  it('falls back to safe defaults for bad filters', () => {
    expect(parseFilters({ country: 'ZZ', platform: 'symbian', days: '13' }, 100)).toEqual({ country: 'WW', platform: 'all', days: 30, end: 100 });
    expect(parseFilters({ country: 'JP', platform: 'ios', days: '90' }, 100)).toEqual({ country: 'JP', platform: 'ios', days: 90, end: 100 });
  });
});

describe('domains', () => {
  it('ads: channel and format splits add up to total spend', () => {
    const o = adsOverview(f);
    expect(sum(o.channelTotals.map((c) => c.value))).toBeCloseTo(o.kpis.spend.value, 2);
    expect(sum(o.formatTotals.map((c) => c.value))).toBeCloseTo(o.kpis.spend.value, 2);
    expect(sum(o.spendByChannel.map(sum))).toBeCloseTo(o.kpis.spend.value, 2);
  });
  it('web: source split adds up to total visits', () => {
    const o = webOverview(f);
    expect(sum(o.sources.map((s) => s.value))).toBeCloseTo(o.kpis.visits.value, 2);
  });
  it('games: genres add up to the games market', () => {
    const o = gamesOverview(f);
    expect(sum(o.genres.map((g) => g.revenue))).toBeCloseTo(o.kpis.revenue.value, 2);
    expect(sum(o.revenueByGenre.map(sum))).toBeCloseTo(o.kpis.revenue.value, 2);
  });
  it('audience: shares are valid probabilities', () => {
    const a = audience(APPS[3], f);
    expect(sum(a.ages.map((x) => x.share))).toBeCloseTo(1, 6);
    expect(sum(a.hourly.map((x) => x.share))).toBeCloseTo(1, 6);
    for (const o of a.overlap) expect(o.overlap).toBeGreaterThan(0), expect(o.overlap).toBeLessThan(1);
    for (const c of a.cohorts) for (const v of [c.d1, c.d7, c.d30]) if (v !== null) expect(v).toBeLessThanOrEqual(1);
  });
});

describe('live connector', () => {
  const feed = { feed: { updated: 'Mon, 1 Jan 2026 00:00:00 +0000', results: [
    { id: '10', name: 'Alpha', artistName: 'A Inc', artworkUrl100: 'https://x/a.png', url: 'https://x/a', genres: [{ name: 'Games' }], releaseDate: '2024-01-01' },
    { id: '20', name: 'Beta', artistName: 'B Inc', artworkUrl100: 'https://x/b.png', url: 'https://x/b', genres: [] },
  ] } };
  const lookup = { results: [{ trackId: 10, averageUserRating: 4.5, userRatingCount: 1200, primaryGenreName: 'Puzzle', formattedPrice: 'Free' }] };

  it('parses the feed and merges lookup data', () => {
    const { entries, updated } = parseFeed(feed, lookup);
    expect(updated).toContain('2026');
    expect(entries[0]).toMatchObject({ rank: 1, id: '10', genre: 'Puzzle', rating: 4.5, ratingCount: 1200, price: 'Free' });
    expect(entries[1]).toMatchObject({ rank: 2, name: 'Beta', genre: null, rating: null });
  });
  it('reports unavailable instead of throwing when the network fails', async () => {
    const r = await liveChart('fr', 'top-paid', async () => { throw new Error('blocked'); });
    expect(r.available).toBe(false);
    expect(r.reason).toContain('blocked');
  });
  it('still returns the chart when only the ratings lookup fails', async () => {
    const r = await liveChart('de', 'top-free', async (url) => {
      if (url.includes('lookup')) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => feed };
    });
    expect(r.available).toBe(true);
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0].rating).toBeNull();
  });
});

describe('http api', () => {
  const app = createApp();
  it('serves every module', async () => {
    const id = APPS[0].id;
    const paths = [
      '/api/meta', '/api/overview?days=7', '/api/apps/top?metric=revenue&category=Puzzle&country=US&platform=ios',
      `/api/apps/${id}`, `/api/apps/compare?ids=${id},${APPS[1].id}`, `/api/apps/batch?ids=${id}`,
      '/api/publishers/top', `/api/publishers/${APPS[0].publisherId}`, '/api/ads/overview', '/api/ads/creatives?format=Video',
      '/api/web/overview', `/api/web/sites/${SITES[0].domain}`, `/api/audience/${id}`, '/api/games/overview', '/api/search?q=lu',
    ];
    for (const p of paths) {
      const res = await request(app).get(p);
      expect(res.status, p).toBe(200);
      expect(JSON.stringify(res.body), p).not.toMatch(/NaN|Infinity/);
    }
  });
  it('returns 404 for unknown entities and endpoints', async () => {
    expect((await request(app).get('/api/apps/nope')).status).toBe(404);
    expect((await request(app).get('/api/web/sites/nope.example')).status).toBe(404);
    expect((await request(app).get('/api/nope')).status).toBe(404);
  });
});
