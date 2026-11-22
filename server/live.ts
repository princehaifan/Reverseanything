// Live connector: real App Store top charts from Apple's public marketing feed,
// enriched with ratings from the public iTunes lookup API. Unlike the rest of
// the dataset these are real, current rankings. Results are cached in memory.

export const LIVE_COUNTRIES = ['us', 'gb', 'de', 'fr', 'jp', 'kr', 'br', 'in', 'id', 'mx', 'ca', 'cn'] as const;
export const LIVE_CHARTS = ['top-free', 'top-paid'] as const;

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
  const res = await fetcher(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Turn Apple's feed payload (plus optional lookup payload) into chart rows. */
export function parseFeed(feed: any, lookup: any = null): { updated: string | null; entries: LiveEntry[] } {
  const results: any[] = feed?.feed?.results ?? [];
  const extra = new Map<string, any>((lookup?.results ?? []).map((x: any) => [String(x.trackId), x]));
  return {
    updated: feed?.feed?.updated ?? null,
    entries: results.map((x, i) => {
      const e = extra.get(String(x.id));
      return {
        rank: i + 1, id: String(x.id), name: String(x.name ?? ''), publisher: String(x.artistName ?? ''),
        icon: String(x.artworkUrl100 ?? ''), url: String(x.url ?? ''),
        genre: e?.primaryGenreName ?? x.genres?.[0]?.name ?? null,
        releaseDate: x.releaseDate ?? null,
        rating: typeof e?.averageUserRating === 'number' ? e.averageUserRating : null,
        ratingCount: typeof e?.userRatingCount === 'number' ? e.userRatingCount : null,
        price: e?.formattedPrice ?? null,
      };
    }),
  };
}

export async function liveChart(countryIn: string, chartIn: string, fetcher: FetchLike = fetch as FetchLike): Promise<LiveChart> {
  const country = (LIVE_COUNTRIES as readonly string[]).includes(countryIn) ? countryIn : 'us';
  const chart = (LIVE_CHARTS as readonly string[]).includes(chartIn) ? chartIn : 'top-free';
  const key = `${country}/${chart}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  try {
    const feed = await getJson(fetcher, `https://rss.marketingtools.apple.com/api/v2/${country}/apps/${chart}/50/apps.json`);
    const ids = (feed?.feed?.results ?? []).map((x: any) => x.id).join(',');
    // Ratings are a nice-to-have: the chart still renders if the lookup fails.
    const lookup = ids ? await getJson(fetcher, `https://itunes.apple.com/lookup?id=${ids}&country=${country}`).catch(() => null) : null;
    const data: LiveChart = { available: true, country, chart, fetchedAt: new Date().toISOString(), ...parseFeed(feed, lookup) };
    if (!data.entries.length) throw new Error('feed returned no entries');
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
