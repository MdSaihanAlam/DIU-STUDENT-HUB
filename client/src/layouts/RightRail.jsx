import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { api } from '../services/api.js';
import { LetterTile, Skeleton } from '../components/ui.jsx';
import { formatDate, formatTime } from '../utils/format.js';

function useRailData() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get('/posts/trending').catch(() => null),
      api.get('/events', { limit: 3 }).catch(() => null),
      api.get('/communities', { limit: 6 }).catch(() => null),
    ]).then(([trending, events, communities]) => alive && setData({ trending, events: events?.items || [], communities: (communities?.items || []).filter((c) => !c.membership).slice(0, 3) }));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

export const RightRail = memo(function RightRail() {
  const data = useRailData();
  return (
    <aside className="rail" aria-label="Highlights">
      <section className="card">
        <h3>
          <TrendingUp size={17} aria-hidden="true" /> Trending this week
        </h3>
        {!data ? (
          <div className="stack" style={{ gap: 10 }}>
            <Skeleton h={14} />
            <Skeleton h={14} w="70%" />
            <Skeleton h={14} w="80%" />
          </div>
        ) : data.trending?.hashtags?.length ? (
          <ol className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {data.trending.hashtags.slice(0, 5).map((h, i) => (
              <li key={h.tag}>
                <Link to={`/feed?hashtag=${encodeURIComponent(h.tag)}`} className="list-item" style={{ padding: '8px 0', color: 'inherit' }}>
                  <span className="trend-rank">{i + 1}</span>
                  <span className="grow">
                    <span className="bold small truncate" style={{ display: 'block' }}>
                      #{h.tag}
                    </span>
                    <span className="xs subtle">
                      {h.count} post{h.count === 1 ? '' : 's'}
                    </span>
                  </span>
                  <ArrowUpRight size={15} className="subtle" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="small muted mb-0">Use #hashtags in posts to start a trend.</p>
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <h3 className="mb-0">
            <CalendarDays size={17} aria-hidden="true" /> Upcoming
          </h3>
          <Link to="/events" className="xs bold">
            See all
          </Link>
        </div>
        {!data ? (
          <Skeleton h={52} />
        ) : data.events.length ? (
          <div className="list">
            {data.events.map((e) => (
              <Link key={e._id} to={`/events/${e._id}`} className="list-item" style={{ color: 'inherit', padding: '9px 0' }}>
                <div className="date-tile sm">
                  <b>{new Date(e.startsAt).getDate()}</b>
                  <span>{formatDate(e.startsAt, { month: 'short' })}</span>
                </div>
                <div className="grow">
                  <div className="small bold clamp-2">{e.title}</div>
                  <div className="xs muted truncate">
                    {formatTime(e.startsAt)} · {e.venue || 'Online'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="small muted mb-0">No upcoming events.</p>
        )}
      </section>

      {data?.communities?.length > 0 && (
        <section className="card">
          <h3>
            <Users size={17} aria-hidden="true" /> Communities for you
          </h3>
          <div className="list">
            {data.communities.map((c) => (
              <Link key={c._id} to={`/communities/${c.slug}`} className="list-item" style={{ color: 'inherit', padding: '9px 0' }}>
                <LetterTile name={c.name} size={36} radius={11} />
                <div className="grow">
                  <div className="small bold truncate">{c.name}</div>
                  <div className="xs muted">{c.memberCount} members</div>
                </div>
                <span className="btn btn-soft btn-sm" aria-hidden="true">
                  View
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card" style={{ background: 'var(--grad-brand-soft)', borderColor: 'var(--primary-soft)' }}>
        <h3>
          <ShieldCheck size={17} aria-hidden="true" /> Independent platform
        </h3>
        <p className="small muted mb-0">
          Run by students — not officially operated or endorsed by Dhaka International University. Look for the <b>Official</b> and <b>Verified</b> labels.
        </p>
      </section>

      <footer className="rail-footer">
        <Link to="/about">About</Link>
        <Link to="/guidelines">Guidelines</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/contact">Contact</Link>
      </footer>
    </aside>
  );
});
