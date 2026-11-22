// Response types for the client, inferred from the server implementation.
import type { adsOverview, audience, creativeGallery, gamesOverview, siteDetail, webOverview } from './domains';
import type { appDetail, compare, overview, publisherDetail, summarize, topApps, topPublishers } from './metrics';

export type { LiveChart, LiveEntry } from './live';
export type Overview = ReturnType<typeof overview>;
export type AppSummary = ReturnType<typeof summarize>;
export type TopApp = ReturnType<typeof topApps>[number];
export type AppDetail = ReturnType<typeof appDetail>;
export type Compare = ReturnType<typeof compare>;
export type TopPublisher = ReturnType<typeof topPublishers>[number];
export type PublisherDetail = NonNullable<ReturnType<typeof publisherDetail>>;
export type AdsOverview = ReturnType<typeof adsOverview>;
export type Creative = ReturnType<typeof creativeGallery>[number];
export type WebOverview = ReturnType<typeof webOverview>;
export type SiteDetail = NonNullable<ReturnType<typeof siteDetail>>;
export type Audience = ReturnType<typeof audience>;
export type GamesOverview = ReturnType<typeof gamesOverview>;
export interface Meta {
  countries: { code: string; name: string }[];
  categories: string[]; genres: string[]; channels: string[]; formats: string[];
  latestDate: string;
  counts: { apps: number; publishers: number; sites: number };
  live: { countries: string[]; charts: string[] };
}
export interface SearchResults {
  apps: { id: string; name: string; hue: number; category: string; publisher: string }[];
  publishers: { id: string; name: string }[];
  sites: { domain: string; name: string; hue: number }[];
}
