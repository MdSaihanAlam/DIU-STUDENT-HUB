import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Briefcase, CalendarDays, FlaskConical, GraduationCap, Home, Megaphone, Search, ShieldCheck, Users } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, Badge, SampleBadge, Skeleton } from '../components/ui.jsx';
import { plainText } from '../components/common.jsx';
import { useDebounce, useDocumentTitle } from '../hooks/index.js';
import { formatDateTime, humanize } from '../utils/format.js';

const FEATURES = [
  { icon: BookOpen, title: 'Notes & resources', text: 'Lecture notes, slides and previous questions organised by department, course and semester.' },
  { icon: Users, title: 'Student network', text: 'Department, batch and study-group communities with posts, questions and polls.' },
  { icon: Home, title: 'Housing', text: 'Mess seats, sublets, hostels and roommates near campus — with private contact by default.' },
  { icon: FlaskConical, title: 'Research hub', text: 'Explore student and faculty projects, follow progress and request to collaborate.' },
  { icon: GraduationCap, title: 'Alumni & mentors', text: 'Learn from graduates, explore career paths and request mentorship.' },
  { icon: Briefcase, title: 'Careers', text: 'Internships, jobs, scholarships and hackathons with deadline reminders.' },
];

function PublicSearch() {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const [results, setResults] = useState(null);
  useEffect(() => {
    if (dq.trim().length < 2) return setResults(null);
    let alive = true;
    api
      .get('/public/search', { q: dq })
      .then((r) => alive && setResults(r))
      .catch(() => alive && setResults({ resources: [], communities: [] }));
    return () => {
      alive = false;
    };
  }, [dq]);
  return (
    <div>
      <form className="hero-search" role="search" onSubmit={(e) => e.preventDefault()}>
        <Search size={20} style={{ alignSelf: 'center', marginLeft: 8, color: '#94a6cf' }} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search course codes, notes or communities (e.g. CSE 213)" aria-label="Search campus resources and communities" />
        <Link to="/register" className="btn btn-primary">
          Join free
        </Link>
      </form>
      {results && (
        <div className="hero-results" aria-live="polite">
          {results.resources.length + results.communities.length === 0 ? (
            <p className="muted small mb-0">No public matches. Sign in to search posts, people and research.</p>
          ) : (
            <div className="list">
              {results.resources.map((r) => (
                <Link key={r._id} to={`/resources/${r._id}`} className="list-item" style={{ color: 'inherit', padding: '8px 4px' }}>
                  <BookOpen size={16} className="subtle" aria-hidden="true" />
                  <span className="grow truncate small bold">{r.title}</span>
                  <Badge>{r.courseCode}</Badge>
                </Link>
              ))}
              {results.communities.map((c) => (
                <Link key={c._id} to={`/communities/${c.slug}`} className="list-item" style={{ color: 'inherit', padding: '8px 4px' }}>
                  <Users size={16} className="subtle" aria-hidden="true" />
                  <span className="grow truncate small bold">{c.name}</span>
                  <span className="xs subtle">{c.memberCount} members</span>
                </Link>
              ))}
              <p className="xs subtle mb-0" style={{ padding: '6px 4px 0' }}>
                Opening an item asks you to sign in.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Landing() {
  useDocumentTitle('');
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState(null);
  useEffect(() => {
    api
      .get('/public/highlights')
      .then(setData)
      .catch(() => setData({ counts: {}, research: [], events: [], stories: [], announcements: [], topics: [] }));
  }, []);
  const c = data?.counts || {};

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="eyebrow">
              <ShieldCheck size={15} aria-hidden="true" /> Independent student community · Not an official DIU service
            </span>
            <h1>
              The digital campus for <span className="grad">DIU students</span>, faculty & alumni.
            </h1>
            <p className="lead">Share notes, ask questions, find a mess seat, discover research and land your next internship — all in one place, built by the community.</p>
            <PublicSearch />
            <div className="row-wrap" style={{ gap: 10 }}>
              <Link to={isAuthenticated ? '/feed' : '/register'} className="btn btn-primary btn-lg">
                {isAuthenticated ? 'Open your feed' : 'Create your account'} <ArrowRight size={18} aria-hidden="true" />
              </Link>
              {!isAuthenticated && (
                <Link to="/login" className="btn btn-lg" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}>
                  Sign in
                </Link>
              )}
            </div>
            <div className="hero-stats">
              {[
                ['members', 'Members'],
                ['resources', 'Study resources'],
                ['research', 'Research projects'],
                ['communities', 'Communities'],
              ].map(([k, l]) => (
                <div key={k}>
                  <strong>{data ? (c[k] ?? 0).toLocaleString() : '—'}</strong>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-preview" aria-label="Community preview">
            <div className="glass">
              <div className="row" style={{ marginBottom: 8 }}>
                <Megaphone size={16} aria-hidden="true" />
                <span className="small bold">Latest official announcements</span>
              </div>
              {!data ? (
                <Skeleton h={40} style={{ opacity: 0.2 }} />
              ) : data.announcements.length ? (
                data.announcements.map((a) => (
                  <p key={a._id} className="small clamp-2" style={{ marginBottom: 8 }}>
                    {plainText(a.content)}
                  </p>
                ))
              ) : (
                <p className="small mb-0">No announcements yet.</p>
              )}
            </div>
            <div className="glass">
              <div className="small bold" style={{ marginBottom: 8 }}>
                Trending in the community
              </div>
              <div className="row-wrap">
                {(data?.topics || []).map((t) => (
                  <Badge key={t.tag}>#{t.tag}</Badge>
                ))}
                {data && !data.topics.length && <span className="small">Start the first conversation.</span>}
              </div>
            </div>
            <div className="glass">
              <div className="small bold" style={{ marginBottom: 8 }}>
                Upcoming
              </div>
              {(data?.events || []).slice(0, 2).map((e) => (
                <div key={e._id} className="row" style={{ marginBottom: 6 }}>
                  <CalendarDays size={15} aria-hidden="true" />
                  <span className="small truncate grow">{e.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section container" id="features">
        <div className="section-head">
          <h2>Everything campus life needs</h2>
          <p>Practical tools that save time for real DIU students — not just another social feed.</p>
        </div>
        <div className="grid grid-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card feature-card">
              <div className="feature-icon">
                <f.icon size={22} aria-hidden="true" />
              </div>
              <h3>{f.title}</h3>
              <p className="muted mb-0">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section container" id="research">
        <div className="section-title">
          <h2>Featured research</h2>
          <Link to="/research" className="small">
            Explore research hub →
          </Link>
        </div>
        <div className="grid grid-3">
          {!data
            ? [1, 2, 3].map((i) => <Skeleton key={i} h={140} r={16} />)
            : data.research.map((r) => (
                <Link key={r._id} to={`/research/${r._id}`} className="card card-link">
                  <div className="row-wrap" style={{ marginBottom: 8 }}>
                    <Badge tone="accent">{r.domain}</Badge>
                    <Badge>{humanize(r.status)}</Badge>
                    <SampleBadge show={r.isDemo} />
                  </div>
                  <div className="card-title">{r.title}</div>
                  <p className="muted small clamp-3 mb-0">{r.abstract}</p>
                </Link>
              ))}
          {data && !data.research.length && <p className="muted">No featured projects yet.</p>}
        </div>
      </section>

      <section className="section container" id="events">
        <div className="section-title">
          <h2>Upcoming events</h2>
          <Link to="/events" className="small">
            All events →
          </Link>
        </div>
        <div className="grid grid-2">
          {(data?.events || []).map((e) => (
            <Link key={e._id} to={`/events/${e._id}`} className="card card-link row" style={{ alignItems: 'flex-start', gap: 14 }}>
              <div className="date-tile">
                <b>{new Date(e.startsAt).getDate()}</b>
                <span>{new Date(e.startsAt).toLocaleString('en', { month: 'short' })}</span>
              </div>
              <div className="grow">
                <div className="row-wrap" style={{ marginBottom: 4 }}>
                  {e.official ? <Badge tone="violet">Official</Badge> : <Badge>Community</Badge>}
                  <SampleBadge show={e.isDemo} />
                </div>
                <div className="card-title">{e.title}</div>
                <div className="small muted">
                  {formatDateTime(e.startsAt)} · {e.venue || 'Online'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {data?.stories?.length > 0 && (
        <section className="section container">
          <div className="section-head">
            <h2>Alumni success stories</h2>
            <p>Graduates sharing the paths that worked for them.</p>
          </div>
          <div className="grid grid-3">
            {data.stories.map((s) => (
              <figure key={s._id} className="card" style={{ margin: 0 }}>
                <SampleBadge show={s.isDemo} />
                <blockquote style={{ margin: '10px 0 16px', fontSize: '0.98rem' }}>
                  <div className="bold" style={{ marginBottom: 6 }}>
                    {s.successStory.title}
                  </div>
                  <span className="muted">“{s.successStory.excerpt}…”</span>
                </blockquote>
                <figcaption className="row">
                  <Avatar user={s.user} size="sm" />
                  <div>
                    <div className="small bold">{s.user?.name}</div>
                    <div className="xs muted">
                      {s.jobTitle} · {s.employer} · Class of {s.graduationYear}
                    </div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="section container">
        <div className="cta">
          <div>
            <h2>Join your campus community</h2>
            <p className="mb-0">Free for DIU students, faculty and alumni. Your contact details stay private by default.</p>
          </div>
          <Link to={isAuthenticated ? '/feed' : '/register'} className="btn btn-lg" style={{ background: '#fff', color: 'var(--navy-900)', border: 0 }}>
            {isAuthenticated ? 'Go to the hub' : 'Get started'} <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
