// Live connector: real App Store top charts from Apple's public iTunes RSS feed,
// enriched with ratings from the public iTunes lookup API. Unlike the rest of
// the dataset these are real, current rankings. Results are cached in memory.

export const LIVE_COUNTRIES = ['us', 'gb', 'de', 'fr', 'jp', 'kr', 'br', 'in', 'id', 'mx', 'ca', 'cn'] as const;
export const LIVE_CHARTS = ['top-free', 'top-paid', 'top-grossing'] as const;
const FEED_NAME: Record<string, string> = {
  'top-free': 'topfreeapplications', 'top-paid': 'toppaidapplications', 'top-grossing': 'topgrossingapplications',
};

export interface LiveEntry {
  rank: number; id: string; name: string; publisher: string; icon: string; url: string;
  genre: string | null; releaseDate: string | null;
  rating: number | null; ratingCount: number | null; price: string | null;
}
export interface LiveChart {
  available: boolean; reason?: string;
  country: string; chart: string; updated: string | null; fetchedAt: string | null;
  entries: LiveEntry[];
}

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; data: LiveChart }>();

async function getJson(fetcher: FetchLike, url: string): Promise<any> {
  const res = await fetcher(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Turn Apple's feed payload (plus optional lookup payload) into chart rows. */
export function parseFeed(feed: any, lookup: any = null): { updated: string | null; entries: LiveEntry[] } {
  const raw = feed?.feed?.entry;
  // A one-item feed arrives as a bare object rather than an array.
  const results: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const extra = new Map<string, any>((lookup?.results ?? []).map((x: any) => [String(x.trackId), x]));
  return {
    updated: feed?.feed?.updated?.label ?? null,
    entries: results.map((x, i) => {
      const id = String(x?.id?.attributes?.['im:id'] ?? '');
      const e = extra.get(id);
      const images: any[] = Array.isArray(x?.['im:image']) ? x['im:image'] : [];
      const amount = Number(x?.['im:price']?.attributes?.amount);
      return {
        rank: i + 1, id,
        name: String(x?.['im:name']?.label ?? ''),
        publisher: String(x?.['im:artist']?.label ?? ''),
        icon: String(images[images.length - 1]?.label ?? ''),
        url: String(x?.id?.label ?? ''),
        genre: x?.category?.attributes?.label ?? e?.primaryGenreName ?? null,
        releaseDate: typeof x?.['im:releaseDate']?.label === 'string' ? x['im:releaseDate'].label.slice(0, 10) : null,
        rating: typeof e?.averageUserRating === 'number' ? e.averageUserRating : null,
        ratingCount: typeof e?.userRatingCount === 'number' ? e.userRatingCount : null,
        price: amount === 0 ? 'Free' : e?.formattedPrice ?? x?.['im:price']?.label ?? null,
      };
    }).filter((e) => e.id && e.name),
  };
}

export async function liveChart(countryIn: string, chartIn: string, fetcher: FetchLike = fetch as FetchLike): Promise<LiveChart> {
  const country = (LIVE_COUNTRIES as readonly string[]).includes(countryIn) ? countryIn : 'us';
  const chart = (LIVE_CHARTS as readonly string[]).includes(chartIn) ? chartIn : 'top-free';
  const key = `${country}/${chart}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  try {
    const feed = await getJson(fetcher, `https://itunes.apple.com/${country}/rss/${FEED_NAME[chart]}/limit=50/json`);
    const parsed = parseFeed(feed);
    if (!parsed.entries.length) throw new Error('feed returned no entries');
    // Ratings are a nice-to-have: the chart still renders if the lookup fails.
    const ids = parsed.entries.map((e) => e.id).join(',');
    const lookup = await getJson(fetcher, `https://itunes.apple.com/lookup?id=${ids}&country=${country}`).catch(() => null);
    const data: LiveChart = { available: true, country, chart, fetchedAt: new Date().toISOString(), ...parseFeed(feed, lookup) };
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (hit) return hit.data; // serve stale rather than nothing
    return {
      available: false, country, chart, updated: null, fetchedAt: null, entries: [],
      reason: `Could not reach Apple's chart feed (${err instanceof Error ? err.message : 'unknown error'}).`,
    };
  }
}
