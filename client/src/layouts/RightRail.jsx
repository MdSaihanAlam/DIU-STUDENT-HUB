import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Hash, Info, TrendingUp, Users } from 'lucide-react';
import { api } from '../services/api.js';
import { Skeleton } from '../components/ui.jsx';
import { formatDate } from '../utils/format.js';

function useRailData() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get('/posts/trending').catch(() => null),
      api.get('/events', { limit: 3 }).catch(() => null),
      api.get('/communities', { limit: 4 }).catch(() => null),
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
        <h3 className="row">
          <TrendingUp size={17} aria-hidden="true" /> Trending topics
        </h3>
        {!data ? (
          <div className="stack" style={{ gap: 8 }}>
            <Skeleton h={12} />
            <Skeleton h={12} w="70%" />
            <Skeleton h={12} w="80%" />
          </div>
        ) : data.trending?.hashtags?.length ? (
          <div className="list">
            {data.trending.hashtags.slice(0, 6).map((h) => (
              <Link key={h.tag} to={`/feed?hashtag=${encodeURIComponent(h.tag)}`} className="list-item" style={{ padding: '7px 0', color: 'inherit' }}>
                <Hash size={15} className="subtle" aria-hidden="true" />
                <span className="grow bold small truncate">{h.tag}</span>
                <span className="xs subtle">{h.count} posts</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="small muted mb-0">Use #hashtags in posts to start a trend.</p>
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <h3 className="row">
            <CalendarDays size={17} aria-hidden="true" /> Upcoming events
          </h3>
          <Link to="/events" className="small">
            See all
          </Link>
        </div>
        {!data ? (
          <Skeleton h={48} />
        ) : data.events.length ? (
          <div className="list">
            {data.events.map((e) => (
              <Link key={e._id} to={`/events/${e._id}`} className="list-item" style={{ color: 'inherit', padding: '8px 0' }}>
                <div className="date-tile" style={{ width: 44, padding: '4px 0' }}>
                  <b style={{ fontSize: '1.05rem' }}>{new Date(e.startsAt).getDate()}</b>
                  <span>{formatDate(e.startsAt, { month: 'short' })}</span>
                </div>
                <div className="grow">
                  <div className="small bold clamp-2">{e.title}</div>
                  <div className="xs muted truncate">{e.venue || 'Online'}</div>
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
          <h3 className="row">
            <Users size={17} aria-hidden="true" /> Suggested communities
          </h3>
          <div className="list">
            {data.communities.map((c) => (
              <Link key={c._id} to={`/communities/${c.slug}`} className="list-item" style={{ color: 'inherit', padding: '8px 0' }}>
                <span className="avatar avatar-sm" style={{ borderRadius: 10 }} aria-hidden="true">
                  {c.name[0]}
                </span>
                <div className="grow">
                  <div className="small bold truncate">{c.name}</div>
                  <div className="xs muted">{c.memberCount} members</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card" style={{ background: 'var(--primary-softer)', borderColor: 'var(--primary-soft)' }}>
        <h3 className="row">
          <Info size={17} aria-hidden="true" /> Independent platform
        </h3>
        <p className="small muted mb-0">
          DIU Student Hub is run by students and is not officially operated or endorsed by Dhaka International University. Look for the <b>Official</b> and <b>Verified</b> labels.
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
