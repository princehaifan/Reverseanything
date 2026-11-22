// The demo catalog: fictional apps, publishers and websites. Nothing in here
// refers to a real product; names are generated and domains use the reserved
// `.example` TLD.
import { between, clamp, gauss, normalize, pick, rand } from './rng';

export const DAY_MS = 86_400_000;
/** Reference day (2026-01-01) at which every base level is defined. */
export const REF_DAY = Math.floor(Date.UTC(2026, 0, 1) / DAY_MS);

export const COUNTRIES = [
  { code: 'US', name: 'United States', dl: 0.16, rev: 0.33 },
  { code: 'CN', name: 'China', dl: 0.14, rev: 0.2 },
  { code: 'JP', name: 'Japan', dl: 0.04, rev: 0.14 },
  { code: 'GB', name: 'United Kingdom', dl: 0.03, rev: 0.05 },
  { code: 'DE', name: 'Germany', dl: 0.03, rev: 0.045 },
  { code: 'FR', name: 'France', dl: 0.025, rev: 0.03 },
  { code: 'KR', name: 'South Korea', dl: 0.02, rev: 0.05 },
  { code: 'BR', name: 'Brazil', dl: 0.1, rev: 0.02 },
  { code: 'IN', name: 'India', dl: 0.24, rev: 0.012 },
  { code: 'ID', name: 'Indonesia', dl: 0.08, rev: 0.01 },
  { code: 'MX', name: 'Mexico', dl: 0.05, rev: 0.012 },
  { code: 'CA', name: 'Canada', dl: 0.015, rev: 0.03 },
] as const;
export type CountryCode = (typeof COUNTRIES)[number]['code'] | 'WW';

export const GENRES = [
  'Puzzle', 'Strategy', 'RPG', 'Casino', 'Simulation', 'Action', 'Sports & Racing', 'Casual',
] as const;
export const APP_CATEGORIES = [
  'Social', 'Entertainment', 'Shopping', 'Finance', 'Productivity', 'Health & Fitness',
  'Education', 'Travel', 'Food & Drink', 'Photo & Video', 'Music', 'Utilities',
] as const;
export const CATEGORIES = ['Games', ...APP_CATEGORIES] as const;

export const AD_CHANNELS = [
  'Social feed', 'Short-form video', 'Search', 'In-app video', 'Playable', 'Display', 'Connected TV',
] as const;
export const AD_FORMATS = ['Video', 'Playable', 'Image', 'Carousel'] as const;
export const TRAFFIC_SOURCES = [
  'Direct', 'Organic search', 'Paid search', 'Social', 'Referral', 'Email', 'Display',
] as const;
export const AGE_BANDS = ['18-24', '25-34', '35-44', '45-54', '55+'] as const;

interface Profile {
  rpd: number; // store revenue per download, USD
  dauMult: number; // DAU per daily download
  d1: number; d7: number; d30: number; // retention
  female: number; // share of female users
  age: number; // centre of the age distribution, as an index into AGE_BANDS
  sessions: number; minutes: number; // per user per day / per session
  cpi: number; // cost per paid install, USD
  monet: [number, number, number]; // in-app purchase, advertising, subscription
  weekend: number; // weekend uplift (negative = weekday product)
  channels: number[]; // prior over AD_CHANNELS
}
const P = (
  rpd: number, dauMult: number, d1: number, d7: number, d30: number, female: number, age: number,
  sessions: number, minutes: number, cpi: number, monet: [number, number, number], weekend: number,
  channels: number[],
): Profile => ({ rpd, dauMult, d1, d7, d30, female, age, sessions, minutes, cpi, monet, weekend, channels });

export const PROFILES: Record<string, Profile> = {
  Puzzle: P(1.6, 14, 0.42, 0.2, 0.09, 0.66, 2.3, 4.2, 7, 2.1, [0.6, 0.38, 0.02], 0.1, [3, 2, 0.3, 4, 3, 1, 0.3]),
  Strategy: P(6.2, 11, 0.33, 0.14, 0.07, 0.24, 1.9, 5.1, 11, 4.6, [0.93, 0.05, 0.02], 0.12, [3, 2, 0.5, 2.5, 1.5, 1, 0.8]),
  RPG: P(7.1, 12, 0.36, 0.15, 0.07, 0.31, 1.3, 4.4, 14, 4.1, [0.92, 0.04, 0.04], 0.14, [3, 2.5, 0.5, 2, 1, 1, 0.6]),
  Casino: P(5.2, 16, 0.38, 0.2, 0.11, 0.57, 3.2, 5.6, 9, 5.3, [0.9, 0.09, 0.01], 0.08, [3.5, 1, 0.6, 2.5, 2, 1.4, 0.5]),
  Simulation: P(1.5, 10, 0.37, 0.15, 0.06, 0.52, 1.6, 3.6, 9, 1.4, [0.5, 0.46, 0.04], 0.16, [2.5, 3, 0.3, 4, 2.5, 1, 0.2]),
  Action: P(1.8, 9, 0.34, 0.12, 0.05, 0.2, 0.9, 3.9, 10, 1.6, [0.62, 0.3, 0.08], 0.2, [2.5, 3.5, 0.3, 3, 1.5, 1, 0.4]),
  'Sports & Racing': P(1.2, 9, 0.33, 0.12, 0.05, 0.18, 1.5, 3.2, 9, 1.3, [0.55, 0.38, 0.07], 0.22, [2.5, 3, 0.4, 3, 1.5, 1, 0.8]),
  Casual: P(0.22, 6, 0.3, 0.08, 0.02, 0.5, 1.2, 3.1, 5, 0.45, [0.12, 0.86, 0.02], 0.15, [2, 4, 0.2, 5, 3.5, 0.8, 0.1]),
  Social: P(0.55, 85, 0.62, 0.45, 0.33, 0.54, 1.1, 9.5, 6, 2.2, [0.45, 0.4, 0.15], 0.04, [3, 4, 1, 1, 0, 1.2, 1]),
  Entertainment: P(2.6, 34, 0.48, 0.3, 0.19, 0.5, 1.8, 2.6, 31, 3.4, [0.08, 0.17, 0.75], 0.18, [3, 3, 1, 1, 0, 1.5, 3]),
  Shopping: P(0.04, 24, 0.4, 0.24, 0.14, 0.61, 2.1, 2.2, 6, 3.1, [0.3, 0.6, 0.1], -0.03, [4, 2.5, 3, 0.6, 0, 2.5, 1]),
  Finance: P(0.09, 36, 0.52, 0.38, 0.28, 0.4, 2.2, 1.9, 3, 6.5, [0.1, 0.15, 0.75], -0.18, [3, 1.5, 4, 0.5, 0, 2, 1.5]),
  Productivity: P(1.2, 30, 0.44, 0.3, 0.2, 0.46, 2, 3.4, 5, 2.8, [0.1, 0.1, 0.8], -0.22, [3, 1.5, 4, 0.4, 0, 2, 0.5]),
  'Health & Fitness': P(1.8, 18, 0.38, 0.2, 0.1, 0.63, 1.9, 1.6, 8, 3.6, [0.08, 0.1, 0.82], -0.05, [4, 3, 1.5, 0.6, 0, 1.2, 1]),
  Education: P(1.5, 16, 0.36, 0.19, 0.09, 0.55, 1, 1.5, 10, 2.4, [0.1, 0.15, 0.75], -0.12, [3.5, 3, 2, 0.8, 0, 1.2, 0.5]),
  Travel: P(0.05, 9, 0.24, 0.1, 0.05, 0.51, 2.3, 1.3, 6, 3.9, [0.2, 0.6, 0.2], 0.05, [3, 2, 4.5, 0.4, 0, 2.5, 1.5]),
  'Food & Drink': P(0.05, 14, 0.34, 0.2, 0.12, 0.55, 1.8, 1.4, 5, 3.3, [0.15, 0.55, 0.3], 0.2, [3.5, 2.5, 3, 0.5, 0, 2, 1.5]),
  'Photo & Video': P(1.4, 15, 0.35, 0.17, 0.08, 0.64, 1, 2.1, 7, 1.9, [0.12, 0.28, 0.6], 0.12, [3.5, 4, 1.5, 1, 0, 1, 0.3]),
  Music: P(2.2, 40, 0.5, 0.36, 0.26, 0.48, 1.2, 3.1, 24, 3, [0.05, 0.2, 0.75], 0.02, [3, 3, 1.2, 0.8, 0, 1.5, 2.5]),
  Utilities: P(0.7, 20, 0.36, 0.2, 0.11, 0.42, 2.4, 1.7, 2, 1.1, [0.1, 0.5, 0.4], -0.06, [2, 1.5, 4.5, 2, 0, 2.5, 0.2]),
};

export interface Publisher { id: string; name: string; country: string; games: boolean }
export interface App {
  id: string; name: string; publisherId: string;
  category: string; genre: string | null; segment: string; // segment = genre for games, else category
  platforms: ('ios' | 'android')[];
  hue: number; launchDay: number; growth: number;
  baseDownloads: number; baseRevenue: number; baseDau: number;
  dlShares: number[]; revShares: number[]; // aligned with COUNTRIES
  iosShare: number; iosRevShare: number;
  rating: number; ratingCount: number;
  monet: [number, number, number];
  d1: number; d7: number; d30: number;
  female: number; ageWeights: number[];
  paidShare: number; cpi: number; channelMix: number[]; formatMix: number[];
}
export interface Site {
  domain: string; name: string; category: string; appId: string | null; hue: number;
  baseVisits: number; growth: number; sources: number[]; mobile: number;
  bounce: number; pages: number; duration: number; shares: number[];
}

const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const STEMS = [
  'Lumo', 'Zenda', 'Vibra', 'Novi', 'Kitea', 'Mintra', 'Orbi', 'Trekka', 'Pulsa', 'Hivo', 'Quilla',
  'Sorva', 'Tandra', 'Fablo', 'Aeron', 'Nimba', 'Clovr', 'Pebla', 'Harbo', 'Junoa', 'Looma', 'Wrenn',
  'Ekho', 'Talo', 'Vento', 'Yondo', 'Zumi', 'Kova', 'Brisa', 'Calyx', 'Dovo', 'Elmi', 'Fennu', 'Galo',
];
const APP_SUFFIX: Record<string, string[]> = {
  Social: ['Chat', 'Circle', 'Loop'], Entertainment: ['Play', 'Stream', 'TV'],
  Shopping: ['Cart', 'Mart', 'Shop'], Finance: ['Pay', 'Bank', 'Wallet'],
  Productivity: ['Notes', 'Desk', 'Tasks'], 'Health & Fitness': ['Fit', 'Well', 'Coach'],
  Education: ['Learn', 'Class', 'Lingo'], Travel: ['Trips', 'Stay', 'Go'],
  'Food & Drink': ['Eats', 'Bite', 'Kitchen'], 'Photo & Video': ['Cam', 'Cut', 'Lens'],
  Music: ['Tunes', 'Beat', 'FM'], Utilities: ['Scan', 'Guard', 'Clean'],
};
const GAME_FIRST = [
  'Ember', 'Candy', 'Iron', 'Star', 'Pixel', 'Royal', 'Shadow', 'Lucky', 'Turbo', 'Mystic', 'Tiny',
  'Golden', 'Frost', 'Neon', 'Wild', 'Cosmic', 'Jelly', 'Rogue', 'Crystal', 'Thunder', 'Merge', 'Idle',
];
const GAME_SECOND: Record<string, string[]> = {
  Puzzle: ['Blast', 'Match', 'Garden', 'Tiles', 'Pop', 'Jam'],
  Strategy: ['Empires', 'Legions', 'Siege', 'Kingdoms', 'Frontier', 'Dominion'],
  RPG: ['Chronicles', 'Realms', 'Saga', 'Legends', 'Odyssey', 'Covenant'],
  Casino: ['Slots', 'Jackpot', 'Bingo', 'Poker', 'Fortune', 'Spins'],
  Simulation: ['Farm', 'Tycoon', 'City', 'Cafe', 'Hospital', 'Airport'],
  Action: ['Strike', 'Arena', 'Brawl', 'Hunters', 'Squad', 'Rampage'],
  'Sports & Racing': ['League', 'Drift', 'Kickoff', 'Rally', 'Dunk', 'Circuit'],
  Casual: ['Run', 'Stack', 'Jump', 'Dash', 'Loop', 'Hop'],
};
const PUB_STEMS = [
  'Northwind', 'Bluepeak', 'Saffron', 'Ironwood', 'Halcyon', 'Redshift', 'Marlow', 'Quartz', 'Tessel',
  'Opaline', 'Verdant', 'Kestrel', 'Lanternfish', 'Moonbase', 'Granite', 'Sundial', 'Paperkite',
  'Foxglove', 'Driftwood', 'Cobalt', 'Juniper', 'Meridian',
];
const GAME_PUB_SUFFIX = ['Games', 'Studios', 'Interactive', 'Play'];
const APP_PUB_SUFFIX = ['Labs', 'Digital', 'Works', 'Technologies'];
const PUB_COUNTRIES = ['US', 'US', 'US', 'CN', 'CN', 'JP', 'KR', 'GB', 'DE', 'FR', 'CA', 'IN', 'BR'];

function buildPublishers(): Publisher[] {
  const out: Publisher[] = [];
  PUB_STEMS.forEach((stem, i) => {
    for (const games of [true, false]) {
      const suffix = pick(games ? GAME_PUB_SUFFIX : APP_PUB_SUFFIX, 'pubsuffix', stem, String(games));
      const name = `${stem} ${suffix}`;
      out.push({ id: slug(name), name, country: pick(PUB_COUNTRIES, 'pubcountry', name), games });
    }
    void i;
  });
  return out;
}

function countryShares(id: string, key: 'dl' | 'rev', home: string): number[] {
  return normalize(
    COUNTRIES.map((c) => c[key] * Math.exp(0.7 * gauss('share', id, c.code)) * (c.code === home ? 2.4 : 1)),
  );
}

function buildApp(name: string, segment: string, isGame: boolean, publishers: Publisher[]): App {
  const id = slug(name);
  const p = PROFILES[segment];
  const pool = publishers.filter((x) => x.games === isGame);
  // Skewed assignment: a handful of publishers own most of the portfolio.
  const publisher = pool[Math.floor(Math.pow(rand('pub', id), 1.8) * pool.length)];
  const baseDownloads = 1500 * Math.exp(5.6 * Math.pow(rand('size', id), 1.25));
  const rpd = p.rpd * Math.exp(0.6 * gauss('rpd', id));
  const both = rand('plat', id);
  const platforms: App['platforms'] = both < 0.82 ? ['ios', 'android'] : both < 0.92 ? ['ios'] : ['android'];
  const iosShare = platforms.length === 1 ? (platforms[0] === 'ios' ? 1 : 0) : clamp(0.36 + 0.12 * gauss('ios', id), 0.12, 0.75);
  const recent = rand('recent', id) < 0.12;
  const monet = normalize(p.monet.map((m, i) => m * Math.exp(0.35 * gauss('monet', id, i)))) as App['monet'];
  const jit = (v: number, k: string, s = 0.12) => clamp(v * Math.exp(s * gauss(k, id)), 0.01, 0.95);
  return {
    id, name, publisherId: publisher.id,
    category: isGame ? 'Games' : segment, genre: isGame ? segment : null, segment,
    platforms, hue: Math.floor(rand('hue', id) * 360),
    launchDay: REF_DAY - Math.floor(recent ? between(-40, 200, 'launch', id) : between(260, 2600, 'launch', id)),
    growth: clamp(0.05 + 0.42 * gauss('growth', id) + (recent ? 0.5 : 0), -0.7, 1.6),
    baseDownloads, baseRevenue: baseDownloads * rpd,
    baseDau: baseDownloads * p.dauMult * Math.exp(0.4 * gauss('dau', id)),
    dlShares: countryShares(id, 'dl', publisher.country),
    revShares: countryShares(id, 'rev', publisher.country),
    iosShare,
    iosRevShare: platforms.length === 1 ? iosShare : clamp(iosShare + 0.24, 0.2, 0.9),
    rating: clamp(4.25 + 0.35 * gauss('rating', id), 2.6, 4.9),
    ratingCount: Math.round(baseDownloads * between(3, 30, 'ratings', id)),
    monet, d1: jit(p.d1, 'd1'), d7: jit(p.d7, 'd7', 0.18), d30: jit(p.d30, 'd30', 0.25),
    female: clamp(p.female + 0.08 * gauss('female', id), 0.08, 0.92),
    ageWeights: normalize(AGE_BANDS.map((_, i) => Math.exp(-Math.pow(i - p.age - 0.3 * gauss('age', id), 2) / 2.2))),
    paidShare: clamp(0.34 + 0.2 * gauss('paid', id), 0.03, 0.8),
    cpi: p.cpi * Math.exp(0.3 * gauss('cpi', id)),
    channelMix: normalize(p.channels.map((c, i) => c * Math.exp(0.6 * gauss('chan', id, i)))),
    formatMix: normalize(
      [5, isGame ? 2.2 : 0.05, 2, 1.2].map((c, i) => c * Math.exp(0.5 * gauss('fmt', id, i))),
    ),
  };
}

function buildApps(publishers: Publisher[]): App[] {
  const apps: App[] = [];
  const seen = new Set<string>();
  const unique = (make: (attempt: number) => string) => {
    for (let a = 0; ; a++) {
      const name = make(a);
      if (!seen.has(name)) { seen.add(name); return name; }
    }
  };
  for (const genre of GENRES) {
    for (let i = 0; i < 10; i++) {
      const name = unique((a) => `${pick(GAME_FIRST, 'gf', genre, i, a)} ${pick(GAME_SECOND[genre], 'gs', genre, i, a)}`);
      apps.push(buildApp(name, genre, true, publishers));
    }
  }
  for (const cat of APP_CATEGORIES) {
    for (let i = 0; i < 8; i++) {
      const name = unique((a) => `${pick(STEMS, 'as', cat, i, a)} ${pick(APP_SUFFIX[cat], 'ax', cat, i, a)}`);
      apps.push(buildApp(name, cat, false, publishers));
    }
  }
  return apps;
}

const WEB_ONLY: [string, string][] = [
  ['Daily Ledger', 'News'], ['Harbor Post', 'News'], ['Signal Wire', 'News'], ['Atlas Answers', 'Reference'],
  ['Open Almanac', 'Reference'], ['Codebench', 'Technology'], ['Stackyard', 'Technology'], ['Pixel Forum', 'Community'],
  ['Threadline', 'Community'], ['Bazaar Central', 'Shopping'], ['Outlet Avenue', 'Shopping'], ['Cartwheel', 'Shopping'],
  ['Screenhouse', 'Entertainment'], ['Reel Garden', 'Entertainment'], ['Coinbridge', 'Finance'], ['Ledgerly', 'Finance'],
  ['Roamwise', 'Travel'], ['Farefinder', 'Travel'], ['Tablespoon', 'Food & Drink'], ['Scoreline', 'Sports'],
  ['Matchday Hub', 'Sports'], ['Jobharbor', 'Careers'], ['Homestead Listings', 'Real Estate'], ['Wellspring Health', 'Health & Fitness'],
];
const SOURCE_PRIOR: Record<string, number[]> = {
  News: [4, 3, 0.2, 2, 1.2, 0.6, 0.2], Reference: [2, 7, 0.1, 0.4, 0.8, 0.1, 0.1],
  Shopping: [3.5, 2.5, 1.6, 0.8, 0.7, 0.6, 0.7], Finance: [5, 2.2, 0.9, 0.3, 0.6, 0.6, 0.3],
  Travel: [3, 3, 1.8, 0.5, 0.9, 0.5, 0.5], default: [4, 3, 0.6, 1, 0.8, 0.4, 0.3],
};

function buildSites(apps: App[]): Site[] {
  const make = (name: string, category: string, appId: string | null, base: number, growth: number): Site => {
    const domain = `${slug(name).replace(/-/g, '')}.example`;
    const prior = SOURCE_PRIOR[category] ?? SOURCE_PRIOR.default;
    return {
      domain, name, category, appId, hue: Math.floor(rand('hue', domain) * 360),
      baseVisits: base, growth,
      sources: normalize(prior.map((s, i) => s * Math.exp(0.45 * gauss('src', domain, i)))),
      mobile: clamp(0.58 + 0.14 * gauss('mob', domain), 0.2, 0.92),
      bounce: clamp(0.44 + 0.1 * gauss('bounce', domain), 0.18, 0.8),
      pages: clamp(4.2 * Math.exp(0.4 * gauss('pages', domain)), 1.3, 14),
      duration: clamp(210 * Math.exp(0.5 * gauss('dur', domain)), 35, 1500),
      shares: normalize(COUNTRIES.map((c) => (c.dl + c.rev) * Math.exp(0.8 * gauss('wshare', domain, c.code)))),
    };
  };
  const sites: Site[] = [];
  for (const app of apps) {
    if (app.category === 'Games' ? rand('site', app.id) < 0.15 : rand('site', app.id) < 0.7) {
      const ratio = app.category === 'Games' ? 0.2 : between(0.6, 9, 'webratio', app.id);
      sites.push(make(app.name, app.category, app.id, app.baseDau * ratio * 0.25, app.growth * 0.6));
    }
  }
  for (const [name, category] of WEB_ONLY) {
    const base = 40_000 * Math.exp(5.2 * Math.pow(rand('wsize', name), 1.1));
    sites.push(make(name, category, null, base, clamp(0.02 + 0.25 * gauss('wgrowth', name), -0.4, 0.8)));
  }
  return sites;
}

export const PUBLISHERS = buildPublishers();
export const APPS = buildApps(PUBLISHERS);
export const SITES = buildSites(APPS);

export const appById = new Map(APPS.map((a) => [a.id, a]));
export const publisherById = new Map(PUBLISHERS.map((p) => [p.id, p]));
export const siteByDomain = new Map(SITES.map((s) => [s.domain, s]));
export const siteByApp = new Map(SITES.filter((s) => s.appId).map((s) => [s.appId!, s]));
export const countryIndex = new Map<string, number>(COUNTRIES.map((c, i) => [c.code, i]));

export const lastCompleteDay = () => Math.floor(Date.now() / DAY_MS) - 1;
export const dayToIso = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
