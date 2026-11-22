// Ad, web, audience and gaming intelligence, all derived from the same app model
// so the numbers on different pages agree with each other.
import {
  AD_CHANNELS, AD_FORMATS, AGE_BANDS, APPS, CATEGORIES, COUNTRIES, GENRES, PROFILES, REF_DAY, SITES,
  TRAFFIC_SOURCES, appById, countryIndex, dayToIso, siteByDomain, type App, type Site,
} from './catalog';
import {
  appRef, daily, dates, eventsBetween, groupTop, kpis, matchesCategory, pct, range, retentionCurve,
  segmentBenchmark, seriesFor, share, stickiness, summarize, topApps, total, type Filters,
} from './metrics';
import { between, clamp, gauss, normalize, pick, rand } from './rng';

// ---------------------------------------------------------------- advertising

/** Estimated paid user-acquisition spend for one app on one day (worldwide). */
const spendDaily = (app: App, day: number) => daily(app, 'downloads', day) * app.paidShare * app.cpi;

function spendTotal(app: App, f: Filters, from: number, to: number) {
  let t = 0;
  for (let d = from; d <= to; d++) t += spendDaily(app, d);
  return t * share(app, 'downloads', f.country, f.platform);
}

const HEADLINES: Record<string, string[]> = {
  Games: ['Can you beat level 50?', 'Only 1% finish this', 'Build. Battle. Conquer.', 'Play free today', 'New season is live', 'Your next obsession'],
  default: ['Try it free for 7 days', 'Everything in one place', 'Join millions of users', 'Made for your day', 'Start in 30 seconds', 'Do more, effortlessly'],
};

/**
 * Creatives that ran at any point in [from, to]. Each app keeps a fixed number of
 * creative slots; a slot is refreshed with a new creative when the old one retires.
 */
export function creativesOf(app: App, from: number, to: number) {
  const slots = 3 + Math.floor(app.paidShare * 16);
  const weights = normalize(Array.from({ length: slots }, (_, i) => Math.exp(1.1 * gauss('crw', app.id, i))));
  const out = [];
  for (let i = 0; i < slots; i++) {
    const life = Math.floor(between(30, 200, 'crl', app.id, i));
    const offset = Math.floor(rand('cro', app.id, i) * life);
    for (let g = Math.floor((from - offset) / life); g <= Math.floor((to - offset) / life); g++) {
      const firstSeenDay = offset + g * life;
      if (firstSeenDay + life <= app.launchDay) continue;
      const pickBy = (mix: number[], key: string) => {
        let x = rand(key, app.id, i, g);
        for (let k = 0; k < mix.length; k++) { x -= mix[k]; if (x <= 0) return k; }
        return 0;
      };
      const format = AD_FORMATS[pickBy(app.formatMix, 'crf')];
      out.push({
        id: `${app.id}-c${i + 1}-${g}`,
        app: appRef(app),
        format,
        channel: AD_CHANNELS[pickBy(app.channelMix, 'crc')],
        headline: pick(HEADLINES[app.category === 'Games' ? 'Games' : 'default'], 'crh', app.id, i, g),
        durationSec: format === 'Video' || format === 'Playable' ? pick([6, 15, 15, 30, 30, 45], 'crd', app.id, i, g) : null,
        firstSeenDay: Math.max(firstSeenDay, app.launchDay),
        lastDay: firstSeenDay + life - 1,
        // Share of the app's impressions while live, scaled by how much of the period it ran.
        weight: weights[i] * ((Math.min(to, firstSeenDay + life - 1) - Math.max(from, firstSeenDay) + 1) / (to - from + 1)),
      });
    }
  }
  return out;
}

export function adsOverview(f: Filters, category = 'all') {
  const r = range(f);
  const apps = APPS.filter((a) => matchesCategory(a, category));
  const rows = apps.map((a) => {
    const spend = spendTotal(a, f, r.from, r.to);
    const prev = spendTotal(a, f, r.prevFrom, r.prevTo);
    const top = a.channelMix.indexOf(Math.max(...a.channelMix));
    const active = a.launchDay <= r.to ? creativesOf(a, r.from, r.to) : [];
    return {
      ...appRef(a), spend, spendChange: pct(spend, prev), paidShare: a.paidShare, cpi: a.cpi,
      topChannel: AD_CHANNELS[top], creatives: active.length, app: a,
    };
  });
  const totalSpend = rows.reduce((t, x) => t + x.spend, 0);
  const prevSpend = apps.reduce((t, a) => t + spendTotal(a, f, r.prevFrom, r.prevTo), 0);
  const channelTotals = AD_CHANNELS.map((name, i) => ({
    name, value: rows.reduce((t, x) => t + x.spend * x.app.channelMix[i], 0),
  }));
  const formatTotals = AD_FORMATS.map((name, i) => ({
    name, value: rows.reduce((t, x) => t + x.spend * x.app.formatMix[i], 0),
  }));
  const shares = apps.map((a) => share(a, 'downloads', f.country, f.platform));
  const byChannel = AD_CHANNELS.map(() => [] as number[]);
  for (let d = r.from; d <= r.to; d++) {
    const acc = AD_CHANNELS.map(() => 0);
    apps.forEach((a, ai) => {
      const s = spendDaily(a, d) * shares[ai];
      for (let c = 0; c < acc.length; c++) acc[c] += s * a.channelMix[c];
    });
    acc.forEach((v, c) => byChannel[c].push(v));
  }
  const advertisers = rows
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 25)
    .map(({ app: _app, ...x }, i) => ({ ...x, rank: i + 1, shareOfVoice: totalSpend ? x.spend / totalSpend : 0 }));
  return {
    kpis: {
      spend: { value: totalSpend, change: pct(totalSpend, prevSpend) },
      advertisers: rows.filter((x) => x.spend > 0).length,
      creatives: rows.reduce((t, x) => t + x.creatives, 0),
      avgCpi: totalSpend / Math.max(1, apps.reduce((t, a) => t + total(a, 'downloads', r.from, r.to) * a.paidShare * share(a, 'downloads', f.country, f.platform), 0)),
    },
    dates: dates(f),
    channels: AD_CHANNELS, spendByChannel: byChannel, channelTotals, formatTotals,
    advertisers,
    bySegment: groupTop(rows, (x) => x.genre ?? x.category, (x) => x.spend, 7),
  };
}

export function creativeGallery(f: Filters, q: { category?: string; channel?: string; format?: string; appId?: string }, limit = 36) {
  const r = range(f);
  const out = [];
  for (const a of APPS) {
    if (q.appId ? a.id !== q.appId : !matchesCategory(a, q.category ?? 'all')) continue;
    const spend = spendTotal(a, f, r.from, r.to);
    if (a.launchDay > r.to) continue;
    for (const c of creativesOf(a, r.from, r.to)) {
      if (q.channel && q.channel !== 'all' && c.channel !== q.channel) continue;
      if (q.format && q.format !== 'all' && c.format !== q.format) continue;
      const { weight, firstSeenDay, lastDay, ...rest } = c;
      out.push({
        ...rest,
        firstSeen: dayToIso(firstSeenDay),
        daysActive: Math.min(r.to, lastDay) - firstSeenDay + 1,
        isNew: firstSeenDay >= r.from,
        // Impressions at a blended $9 CPM, split across the app's live creatives.
        impressions: ((spend * weight) / 9) * 1000,
        spend: spend * weight,
      });
    }
  }
  out.sort((a, b) => b.impressions - a.impressions);
  if (q.appId) return out.slice(0, limit);
  // In the market-wide gallery, cap each advertiser so the biggest spenders do not fill the page.
  const perApp = new Map<string, number>();
  return out.filter((c) => {
    const n = (perApp.get(c.app.id) ?? 0) + 1;
    perApp.set(c.app.id, n);
    return n <= 2;
  }).slice(0, limit);
}

// ------------------------------------------------------------------------ web

function visitsDaily(site: Site, day: number): number {
  const dow = (((day + 4) % 7) + 7) % 7;
  const weekend = dow === 0 || dow === 6 ? 0.9 : 1.04;
  return site.baseVisits * Math.exp((site.growth * (day - REF_DAY)) / 365) * weekend * Math.exp(0.05 * gauss('wv', site.domain, day));
}
function visitsTotal(site: Site, country: string, from: number, to: number) {
  let t = 0;
  for (let d = from; d <= to; d++) t += visitsDaily(site, d);
  const ci = countryIndex.get(country);
  return ci === undefined ? t : t * site.shares[ci];
}

function siteSummary(site: Site, f: Filters) {
  const r = range(f);
  const visits = visitsTotal(site, f.country, r.from, r.to);
  const prev = visitsTotal(site, f.country, r.prevFrom, r.prevTo);
  const top = site.sources.indexOf(Math.max(...site.sources));
  return {
    domain: site.domain, name: site.name, category: site.category, hue: site.hue, appId: site.appId,
    visits, visitsChange: pct(visits, prev),
    uniques: visits / clamp(1.6 + site.pages * 0.25, 1.4, 5),
    bounce: site.bounce, pages: site.pages, duration: site.duration, mobile: site.mobile,
    topSource: TRAFFIC_SOURCES[top],
  };
}

export function webOverview(f: Filters, category = 'all') {
  const sites = SITES.filter((s) => category === 'all' || s.category === category);
  const rows = sites.map((s) => siteSummary(s, f)).sort((a, b) => b.visits - a.visits);
  const visits = rows.reduce((t, x) => t + x.visits, 0);
  const prev = rows.reduce((t, x) => t + (x.visitsChange === null ? x.visits : x.visits / (1 + x.visitsChange)), 0);
  const visitsByDomain = new Map(rows.map((x) => [x.domain, x.visits]));
  const w = (fn: (x: (typeof rows)[number]) => number) => rows.reduce((t, x) => t + fn(x) * x.visits, 0) / (visits || 1);
  return {
    kpis: {
      visits: { value: visits, change: pct(visits, prev) },
      bounce: w((x) => x.bounce), duration: w((x) => x.duration), mobile: w((x) => x.mobile),
    },
    sources: TRAFFIC_SOURCES.map((name, i) => ({
      name, value: sites.reduce((t, s) => t + s.sources[i] * visitsByDomain.get(s.domain)!, 0),
    })),
    byCategory: groupTop(rows, (x) => x.category, (x) => x.visits, 7),
    categories: [...new Set(SITES.map((s) => s.category))].sort(),
    sites: rows.slice(0, 60).map((x, i) => ({ ...x, rank: i + 1 })),
  };
}

const KEYWORD_TAILS = ['login', 'app', 'pricing', 'reviews', 'download', 'alternatives', 'support', 'coupon', 'careers', 'api'];

export function siteDetail(domain: string, f: Filters) {
  const site = siteByDomain.get(domain);
  if (!site) return null;
  const r = range(f);
  const ci = countryIndex.get(f.country);
  const cs = ci === undefined ? 1 : site.shares[ci];
  const series: number[] = [];
  for (let d = r.from; d <= r.to; d++) series.push(visitsDaily(site, d) * cs);
  const summary = siteSummary(site, f);
  const brand = site.name.toLowerCase();
  const kw = normalize(KEYWORD_TAILS.map((_, i) => Math.exp(-i * 0.45 + 0.4 * gauss('kw', domain, i))));
  const others = SITES.filter((s) => s !== site);
  const refW = normalize(Array.from({ length: 6 }, (_, i) => Math.exp(-i * 0.5)));
  return {
    ...summary,
    app: site.appId ? appRef(appById.get(site.appId)!) : null,
    dates: dates(f), series,
    sources: TRAFFIC_SOURCES.map((name, i) => ({ name, value: site.sources[i] * summary.visits })),
    devices: [
      { name: 'Mobile web', value: site.mobile * summary.visits },
      { name: 'Desktop', value: (1 - site.mobile) * summary.visits },
    ],
    countries: COUNTRIES.map((c, i) => ({ code: c.code, name: c.name, visits: visitsTotal(site, 'WW', r.from, r.to) * site.shares[i] })),
    keywords: [
      { keyword: brand, share: 0.34, branded: true },
      ...kw.map((s, i) => ({ keyword: `${brand} ${KEYWORD_TAILS[i]}`, share: s * 0.4, branded: true })).slice(0, 5),
      ...kw.slice(0, 4).map((s, i) => ({ keyword: `best ${site.category.toLowerCase()} ${['sites', 'apps', 'tools', 'deals'][i]}`, share: s * 0.26, branded: false })),
    ].sort((a, b) => b.share - a.share),
    referrers: refW.map((w, i) => {
      const o = others[Math.floor(rand('ref', domain, i) * others.length)];
      return { domain: o.domain, visits: w * summary.visits * site.sources[4] };
    }),
    competitors: others
      .filter((s) => s.category === site.category)
      .map((s) => siteSummary(s, f))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 6),
  };
}

// ------------------------------------------------------------------- audience

/** How strongly users of one segment over-index on another (100 = average). */
function affinity(a: string, b: string): number {
  if (a === b) return 320;
  const key = [a, b].sort().join('~');
  const bothGames = (GENRES as readonly string[]).includes(a) && (GENRES as readonly string[]).includes(b);
  return Math.round(clamp((bothGames ? 150 : 100) * Math.exp(0.45 * gauss('aff', key)), 35, 290));
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function audience(app: App, f: Filters) {
  const r = range(f);
  const bench = segmentBenchmark(app.segment);
  const all = segmentAverages();
  const s = summarize(app, f);
  const dau = total(app, 'dau', r.from, r.to);
  const maxDau = Math.max(...APPS.map((a) => total(a, 'dau', r.from, r.to)));
  const overlap = APPS.filter((o) => o !== app)
    .map((o) => {
      const reach = total(o, 'dau', r.from, r.to) / maxDau;
      const aff = affinity(app.segment, o.segment);
      const sameFamily = o.publisherId === app.publisherId ? 1.6 : 1;
      return {
        ...appRef(o),
        overlap: clamp(Math.pow(reach, 0.55) * 0.24 * (aff / 100) * sameFamily * Math.exp(0.2 * gauss('ov', app.id, o.id)), 0.002, 0.88),
        affinity: Math.round(aff * sameFamily),
      };
    })
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 12);
  const p = PROFILES[app.segment];
  const peak = 12 + 8 * clamp(0.5 + 0.3 * gauss('peak', app.id), 0, 1); // local hour of peak usage
  const hourly = normalize(HOURS.map((h) => 0.25 + Math.exp(-Math.pow(h - peak, 2) / 18) + 0.45 * Math.exp(-Math.pow(h - 8, 2) / 6)));
  const cohortStart = f.end - 7 * 8;
  return {
    app: s,
    reach: { dau, mau: dau / stickiness(app), stickiness: stickiness(app) },
    engagement: {
      sessions: p.sessions * Math.exp(0.2 * gauss('sess', app.id)),
      minutes: p.minutes * Math.exp(0.25 * gauss('mins', app.id)),
    },
    gender: { female: app.female, benchmarkFemale: bench.female, marketFemale: all.female },
    ages: AGE_BANDS.map((band, i) => ({
      band, share: app.ageWeights[i], benchmark: bench.ages[i],
      index: Math.round((app.ageWeights[i] / all.ages[i]) * 100),
    })),
    interests: [...GENRES, ...CATEGORIES.slice(1)]
      .filter((seg) => seg !== app.segment)
      .map((seg) => ({ segment: seg, index: affinity(app.segment, seg) }))
      .sort((a, b) => b.index - a.index)
      .slice(0, 10),
    overlap,
    hourly: HOURS.map((h, i) => ({ hour: h, share: hourly[i] })),
    retention: retentionCurve(app.d1, app.d7, app.d30),
    retentionBenchmark: retentionCurve(bench.d1, bench.d7, bench.d30),
    cohorts: Array.from({ length: 8 }, (_, w) => {
      const start = cohortStart + w * 7;
      const age = f.end - start;
      const j = Math.exp(0.06 * gauss('coh', app.id, start));
      const cell = (day: number, base: number) => (age >= day ? clamp(base * j * Math.exp(0.04 * gauss('cc', app.id, start, day)), 0, 1) : null);
      const curve = retentionCurve(app.d1, app.d7, app.d30);
      const at = (day: number) => curve.find((c) => c.day === day)!.value;
      return {
        cohort: dayToIso(start),
        size: Math.round(seriesFor([app], 'downloads', { ...f, days: 7, end: start + 6 }).reduce((a, b) => a + b, 0)),
        d1: cell(1, at(1)), d3: cell(3, at(3)), d7: cell(7, at(7)), d14: cell(14, at(14)), d30: cell(30, at(30)),
      };
    }),
  };
}

let cachedAverages: { female: number; ages: number[] } | null = null;
function segmentAverages() {
  if (!cachedAverages) {
    const w = APPS.map((a) => a.baseDau);
    const t = w.reduce((a, b) => a + b, 0);
    cachedAverages = {
      female: APPS.reduce((acc, a, i) => acc + a.female * w[i], 0) / t,
      ages: AGE_BANDS.map((_, k) => APPS.reduce((acc, a, i) => acc + a.ageWeights[k] * w[i], 0) / t),
    };
  }
  return cachedAverages;
}

// --------------------------------------------------------------------- gaming

export function gamesOverview(f: Filters) {
  const r = range(f);
  const games = APPS.filter((a) => a.category === 'Games');
  const genres = GENRES.map((genre) => {
    const apps = games.filter((a) => a.genre === genre);
    const k = kpis(apps, f);
    const rows = apps.map((a) => summarize(a, f)).sort((a, b) => b.revenue - a.revenue);
    const wavg = (fn: (a: App) => number) => {
      const w = apps.map((a) => total(a, 'revenue', r.from, r.to) * share(a, 'revenue', f.country, f.platform));
      return apps.reduce((t, a, i) => t + fn(a) * w[i], 0) / (w.reduce((a, b) => a + b, 0) || 1);
    };
    const b = segmentBenchmark(genre);
    return {
      genre, titles: apps.length,
      downloads: k.downloads.value, downloadsChange: k.downloads.change,
      revenue: k.revenue.value, revenueChange: k.revenue.change,
      dau: k.dau.value,
      rpd: k.downloads.value ? k.revenue.value / k.downloads.value : 0,
      arpdau: k.dau.value ? k.revenue.value / f.days / k.dau.value : 0,
      d1: b.d1, d7: b.d7, d30: b.d30,
      monetization: { iap: wavg((a) => a.monet[0]), ads: wavg((a) => a.monet[1]), subscription: wavg((a) => a.monet[2]) },
      topTitle: { id: rows[0].id, name: rows[0].name, hue: rows[0].hue },
      top3Share: k.revenue.value ? rows.slice(0, 3).reduce((t, x) => t + x.revenue, 0) / k.revenue.value : 0,
    };
  });
  const liveOps = games
    .flatMap((a) => eventsBetween(a, r.from, r.to).map((e) => ({ ...appRef(a), date: dayToIso(e.day), day: e.day, type: e.type, uplift: e.magnitude })))
    .sort((a, b) => b.day - a.day || b.uplift - a.uplift)
    .slice(0, 14);
  return {
    kpis: kpis(games, f),
    dates: dates(f),
    genres,
    genreNames: GENRES,
    revenueByGenre: GENRES.map((g) => seriesFor(games.filter((a) => a.genre === g), 'revenue', f)),
    topGrossing: topApps('revenue', f, 'Games', 10),
    topDownloaded: topApps('downloads', f, 'Games', 10),
    liveOps,
  };
}
