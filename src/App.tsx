import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { SearchResults } from '../server/api-types';
import { AppIcon, Icon, Select } from './components/ui';
import { fmtDateLong } from './format';
import Ads from './pages/Ads';
import AppDetail from './pages/AppDetail';
import AudiencePage from './pages/Audience';
import Compare from './pages/Compare';
import Games from './pages/Games';
import Live from './pages/Live';
import Methodology from './pages/Methodology';
import Overview from './pages/Overview';
import PublisherDetail from './pages/PublisherDetail';
import TopCharts from './pages/TopCharts';
import Watchlist from './pages/Watchlist';
import { SiteDetail, Web } from './pages/Web';
import { AppProvider, useApp } from './state';

const NAV: { label: string; items: [string, string, string][] }[] = [
  { label: 'Market', items: [['/', 'Overview', 'overview']] },
  {
    label: 'Intelligence',
    items: [
      ['/apps', 'App performance', 'apps'], ['/ads', 'Ad intelligence', 'ads'], ['/web', 'Web traffic', 'web'],
      ['/audience', 'Audience', 'audience'], ['/games', 'Gaming', 'games'],
    ],
  },
  { label: 'Tools', items: [['/compare', 'Compare apps', 'compare'], ['/watchlist', 'Watchlist', 'star'], ['/live', 'Live App Store charts', 'live']] },
];

const PERIODS = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['180', 'Last 6 months'], ['365', 'Last 12 months']] as const;
const PLATFORMS = [['all', 'All platforms'], ['ios', 'iOS'], ['android', 'Android']] as const;

function Search() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<SearchResults | null>(null);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!q.trim()) { setRes(null); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json()).then((d) => { setRes(d); setActive(0); }).catch(() => {});
    }, 120);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !/input|select|textarea/i.test((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  const items = res ? [
    ...res.apps.map((a) => ({ to: `/apps/${a.id}`, name: a.name, sub: `${a.category} · ${a.publisher}`, hue: a.hue, group: 'Apps' })),
    ...res.publishers.map((p) => ({ to: `/publishers/${p.id}`, name: p.name, sub: 'Publisher', hue: null, group: 'Publishers' })),
    ...res.sites.map((s) => ({ to: `/web/${s.domain}`, name: s.domain, sub: s.name, hue: s.hue, group: 'Websites' })),
  ] : [];
  const go = (to: string) => { navigate(to); setOpen(false); setQ(''); input.current?.blur(); };

  return (
    <div className="search" ref={box}>
      <Icon name="search" />
      <input ref={input} className="input" type="search" placeholder="Search apps, publishers, websites  ( / )" value={q}
        aria-label="Search apps, publishers and websites" role="combobox" aria-expanded={open && items.length > 0} aria-controls="search-results"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter' && items[active]) go(items[active].to);
          else if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
        }} />
      {open && res && (
        <div className="search-results" id="search-results" role="listbox">
          {!items.length && <div className="empty">No matches for “{q}”.</div>}
          {items.map((it, i) => (
            <div key={it.to}>
              {(i === 0 || items[i - 1].group !== it.group) && <div className="search-group">{it.group}</div>}
              <button className={`search-item${i === active ? ' active' : ''}`} role="option" aria-selected={i === active}
                onMouseEnter={() => setActive(i)} onClick={() => go(it.to)}>
                {it.hue !== null ? <AppIcon name={it.name} hue={it.hue} size={26} /> : <span style={{ width: 26, textAlign: 'center' }}>🏢</span>}
                <span><div style={{ fontWeight: 550 }}>{it.name}</div><small>{it.sub}</small></span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Shell() {
  const { filters, setFilters, meta, watchlist, theme, setTheme } = useApp();
  const { pathname } = useLocation();
  const main = useRef<HTMLDivElement>(null);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  // The live charts page has its own country/chart controls; the modelled filters do not apply there.
  const filtersApply = !pathname.startsWith('/live') && !pathname.startsWith('/methodology');

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Primary">
        <Link to="/" className="brand" aria-label="Tidemark home">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--accent)" />
            <path d="M6 21c3-6 5-6 8 0s5 6 8 0 3-4 4-6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          <span>Tidemark</span>
        </Link>
        {NAV.map((group) => (
          <div key={group.label} style={{ display: 'contents' }}>
            <div className="nav-label">{group.label}</div>
            {group.items.map(([to, label, icon]) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <Icon name={icon} />{label}
                {to === '/watchlist' && watchlist.length > 0 && <span className="nav-count">{watchlist.length}</span>}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          {meta && <>Tracking {meta.counts.apps} apps, {meta.counts.publishers} publishers and {meta.counts.sites} websites in {meta.countries.length} markets.<br /></>}
          <Link to="/methodology">About the data</Link>
        </div>
      </nav>

      <div className="main" ref={main}>
        <div className="banner" role="note">
          <span><strong>Demo dataset.</strong> Apps, publishers and figures in the modelled views are fictional and generated, not measurements of real products.
            {' '}<Link to="/live">Live App Store charts</Link> use real data. <Link to="/methodology">How it works</Link></span>
        </div>
        <div className="topbar">
          <Search />
          <span className="spacer" />
          {filtersApply && <>
            <Select label="Date range" value={String(filters.days)} onChange={(v) => setFilters({ days: Number(v) })} options={PERIODS} />
            <Select label="Market" value={filters.country} onChange={(v) => setFilters({ country: v })}
              options={[['WW', 'All tracked markets'], ...(meta?.countries ?? []).map((c) => [c.code, c.name] as const)]} />
            <Select label="Platform" value={filters.platform} onChange={(v) => setFilters({ platform: v })} options={PLATFORMS} />
          </>}
          {meta && filtersApply && <span className="chip" title="Latest complete day in the dataset">Data through {fmtDateLong(meta.latestDate)}</span>}
          <button className="btn ghost" onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} title={isDark ? 'Light theme' : 'Dark theme'}>
            <Icon name={isDark ? 'sun' : 'moon'} />
          </button>
        </div>
        <main className="content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/apps" element={<TopCharts />} />
            <Route path="/apps/:id" element={<AppDetail />} />
            <Route path="/publishers/:id" element={<PublisherDetail />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/ads" element={<Ads />} />
            <Route path="/web" element={<Web />} />
            <Route path="/web/:domain" element={<SiteDetail />} />
            <Route path="/audience" element={<AudiencePage />} />
            <Route path="/games" element={<Games />} />
            <Route path="/live" element={<Live />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="*" element={<div className="state">Page not found. <Link to="/" style={{ textDecoration: 'underline' }}>Back to the overview</Link></div>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Shell />
      </AppProvider>
    </BrowserRouter>
  );
}
