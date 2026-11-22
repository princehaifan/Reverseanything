import { Link } from 'react-router-dom';
import type { Creative } from '../../server/api-types';
import { fmtDateLong, fmtMoney, fmtNum } from '../format';
import { AppIcon } from './ui';

/** A stand-in rendering of an ad creative: the demo dataset has no real ad assets. */
export function CreativeTile({ c }: { c: Creative }) {
  const h = c.app.hue;
  return (
    <article className="creative">
      <div className="creative-art" style={{ background: `linear-gradient(160deg, hsl(${h} 62% 46%), hsl(${(h + 55) % 360} 66% 26%))` }}>
        <div className="badges">
          <span className="badge">{c.format}{c.durationSec ? ` · ${c.durationSec}s` : ''}</span>
          {c.isNew && <span className="badge">New</span>}
        </div>
        <h3>{c.headline}</h3>
        <span className="cta">{c.format === 'Playable' ? 'Play now' : 'Install'}</span>
      </div>
      <div className="creative-meta">
        <Link to={`/apps/${c.app.id}`} className="app-cell">
          <AppIcon name={c.app.name} hue={h} size={24} />
          <span className="meta"><span className="name">{c.app.name}</span></span>
        </Link>
        <div className="creative-stats"><span>{c.channel}</span><span>since {fmtDateLong(c.firstSeen)}</span></div>
        <div className="creative-stats"><span><b>{fmtNum(c.impressions)}</b> impressions</span><span><b>{fmtMoney(c.spend)}</b></span></div>
      </div>
    </article>
  );
}
