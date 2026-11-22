# Tidemark

A market intelligence platform for the digital economy: one workspace covering **mobile apps, advertising, web traffic, audience and gaming**.

## What it does

| Area | What you get |
|---|---|
| **Market overview** | Downloads, consumer spend and active users with period-over-period change, category and market breakdowns, fastest growers and decliners |
| **App performance** | Top charts by downloads, revenue or active users, filterable by market, platform, category and game genre; rank movement; publisher leaderboards and portfolio pages |
| **App pages** | Daily trends, category rank history, detected events, market split, monetization and platform mix, retention vs category benchmark, ratings, ad creatives, closest competitors |
| **Ad intelligence** | Estimated spend, share of voice by channel, format mix, top advertisers, cost per install, creative gallery |
| **Web traffic** | Top websites, visits and engagement, traffic sources, devices, keywords, referrers, competing sites |
| **Audience** | Age and gender vs benchmarks, interest affinities, cross-app usage, usage by hour, retention curve and weekly cohorts |
| **Gaming** | Genre market size, revenue per download and ARPDAU, retention benchmarks, monetization model by genre, live-operations feed |
| **Tools** | Compare up to four apps (shareable link), watchlist with alerts, global search, CSV export on every table and chart, table view for every chart, light and dark themes |
| **Live App Store charts** | Real, current top free, top paid and top grossing rankings from Apple's public feed |

## Important: about the data

Commercial products in this space estimate their numbers from proprietary consumer panels, publisher data partnerships and ad-network crawls. None of that exists in public APIs, so:

- **Live App Store charts are real.** They come from Apple's public chart feed and the public iTunes lookup API.
- **Everything else is a demo dataset.** The apps, publishers and websites are fictional, and their figures come from a deterministic model in `server/`. They are not estimates of real products. The app says so on every page.

To run on real data, replace the functions in `server/metrics.ts` and `server/domains.ts` with queries against your own warehouse or a licensed provider. The UI only depends on the JSON shapes under `/api`.

## Run it

Requires Node 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Opens the UI on http://localhost:5173 with the API on port 8787. For a production build:

```bash
npm run build
```

```bash
npm start
```

Then open http://localhost:8787. Set `PORT` to change the port. The live charts page needs outbound HTTPS to `itunes.apple.com`; without it that page shows a notice and the rest keeps working. Behind an HTTP proxy, `npm start` already sets `NODE_USE_ENV_PROXY=1` so Node (22.21 or newer) honours `HTTPS_PROXY`.

```bash
npm test
```

## How it is built

- `server/catalog.ts` builds the fictional catalog (apps, publishers, websites).
- `server/metrics.ts` is the time-series model and the app and publisher aggregations. Every market, platform and category view is a slice of the same per-app daily series, so totals reconcile across pages (the tests check this).
- `server/domains.ts` derives ad, web, audience and gaming intelligence from the same model.
- `server/live.ts` is the Apple connector, cached for 30 minutes and failing soft.
- `server/app.ts` exposes the JSON API (Express) and serves the built UI.
- `src/` is the React + TypeScript UI (Vite, Recharts). Response types are inferred from the server code via `server/api-types.ts`.

### API

All modelled endpoints accept `country` (`WW` or a market code), `platform` (`all`, `ios`, `android`) and `days` (7, 30, 90, 180, 365).

```
GET /api/meta
GET /api/overview
GET /api/apps/top?metric=&category=&limit=
GET /api/apps/:id
GET /api/apps/compare?ids=a,b,c
GET /api/apps/batch?ids=a,b,c
GET /api/publishers/top?metric=&kind=
GET /api/publishers/:id
GET /api/ads/overview?category=
GET /api/ads/creatives?category=&channel=&format=&appId=
GET /api/web/overview?category=
GET /api/web/sites/:domain
GET /api/audience/:appId
GET /api/games/overview
GET /api/search?q=
GET /api/live/charts?country=us&chart=top-free
```
