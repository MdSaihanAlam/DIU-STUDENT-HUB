import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  BookOpen,
  Briefcase,
  CalendarDays,
  EyeOff,
  FileText,
  FlaskConical,
  GraduationCap,
  Heart,
  Lock,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, Badge, IconTile, SampleBadge, Skeleton } from '../components/ui.jsx';
import { plainText } from '../components/common.jsx';
import { useDebounce, useDocumentTitle } from '../hooks/index.js';
import { formatDate, formatTime, humanize } from '../utils/format.js';

const QUICK = ['CSE 213', 'Mess seat', 'Internship', 'Machine Learning'];

function PublicSearch() {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const [results, setResults] = useState(null);
  const inputRef = useRef(null);
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
        <Search size={20} style={{ alignSelf: 'center', marginLeft: 10, color: '#8a9ac6', flexShrink: 0 }} aria-hidden="true" />
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search course codes, notes or communities…" aria-label="Search campus resources and communities" />
        <Link to="/register" className="btn btn-primary">
          Join free
        </Link>
      </form>
      {results ? (
        <div className="hero-results" aria-live="polite">
          {results.resources.length + results.communities.length === 0 ? (
            <p className="muted small mb-0" style={{ padding: 6 }}>
              No public matches. Sign in to search posts, people and research.
            </p>
          ) : (
            <div className="list">
              {results.resources.map((r) => (
                <Link key={r._id} to={`/resources/${r._id}`} className="list-item" style={{ color: 'inherit', padding: '8px 6px' }}>
                  <IconTile icon={FileText} size="sm" />
                  <span className="grow truncate small bold">{r.title}</span>
                  <Badge tone="primary">{r.courseCode}</Badge>
                </Link>
              ))}
              {results.communities.map((c) => (
                <Link key={c._id} to={`/communities/${c.slug}`} className="list-item" style={{ color: 'inherit', padding: '8px 6px' }}>
                  <IconTile icon={Users} size="sm" tone="violet" />
                  <span className="grow truncate small bold">{c.name}</span>
                  <span className="xs subtle">{c.memberCount} members</span>
                </Link>
              ))}
              <p className="xs subtle mb-0" style={{ padding: '8px 6px 2px' }}>
                Opening an item asks you to sign in.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="hero-quick">
          <span>Popular:</span>
          {QUICK.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setQ(t);
                inputRef.current?.focus();
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Stylised preview of the product, built from real UI pieces (no screenshots). */
function HeroMock() {
  return (
    <div className="mock" aria-hidden="true">
      <div className="float-chip c2">
        <IconTile icon={BadgeCheck} size="sm" tone="emerald" />
        <span>
          Faculty verified
          <small>Official announcements</small>
        </span>
      </div>
      <div className="mock-window">
        <div className="mock-bar">
          <i />
          <i />
          <i />
          <span className="mock-url">diu-student-hub · feed</span>
        </div>
        <div className="mock-post">
          <div className="row">
            <Avatar name="Ayesha Rahman" size="sm" />
            <div>
              <div className="bold small" style={{ color: '#fff' }}>
                Ayesha Rahman
              </div>
              <div className="xs">CSE · 2h ago</div>
            </div>
            <span className="badge" style={{ marginLeft: 'auto', background: 'rgba(34,211,238,.15)', color: '#67e8f9' }}>
              Question
            </span>
          </div>
          Can anyone explain BFS vs DFS with a real-world example? Preparing for the Data Structures mid 🙏
          <div className="mock-actions">
            <span>👍 💡 24</span>
            <span>
              <MessageCircle size={12} style={{ display: 'inline', verticalAlign: -2 }} /> 8 answers
            </span>
          </div>
        </div>
        <div className="mock-post">
          <div className="row">
            <Avatar name="Tanvir Hasan" size="sm" />
            <div>
              <div className="bold small" style={{ color: '#fff' }}>
                Tanvir Hasan
              </div>
              <div className="xs">DIU Programmers · 5h ago</div>
            </div>
          </div>
          Our team qualified for the national programming contest regionals! 🏆 #competitiveprogramming
          <div className="mock-actions">
            <span>
              <Heart size={12} style={{ display: 'inline', verticalAlign: -2 }} /> 112
            </span>
            <span>32 comments</span>
          </div>
        </div>
        <div className="mock-post" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconTile icon={FileText} size="sm" />
          <div className="grow">
            <div className="bold small" style={{ color: '#fff' }}>
              Algorithms — DP slides.pdf
            </div>
            <div className="xs">CSE 221 · 1.2k downloads · ★ 4.8</div>
          </div>
        </div>
      </div>
      <div className="float-chip c1">
        <IconTile icon={BedDouble} size="sm" tone="pink" />
        <span>
          Mess seat · ৳4,500
          <small>Badda · 10 min walk</small>
        </span>
      </div>
      <div className="float-chip c3">
        <IconTile icon={Briefcase} size="sm" tone="amber" />
        <span>
          Backend internship
          <small>Closes in 3 days</small>
        </span>
      </div>
    </div>
  );
}

const BENTO = [
  {
    cls: 'b-wide',
    icon: BookOpen,
    tone: 'blue',
    title: 'Notes that are actually organised',
    text: 'Lecture notes, slides and previous questions by department, course code and semester — rated by the people who used them.',
    rows: [
      ['CSE 213 · Graph traversal notes', '★ 4.9'],
      ['EEE 111 · Circuit practice set', '★ 4.7'],
    ],
  },
  {
    cls: 'b-wide',
    icon: BedDouble,
    tone: 'pink',
    title: 'Find a place near campus',
    text: 'Mess seats, sublets, hostels and roommates — contact stays private until you choose to share it.',
    rows: [
      ['Mess seat · Badda', '৳4,500'],
      ['Female hostel · Satarkul', '৳6,500'],
    ],
  },
  { cls: 'b-third', icon: FlaskConical, tone: 'violet', title: 'Research hub', text: 'Follow student & faculty projects, see verified results, and request to collaborate.' },
  { cls: 'b-third', icon: GraduationCap, tone: 'emerald', title: 'Alumni mentors', text: 'Learn real career paths from graduates and ask for mentorship.' },
  { cls: 'b-third', icon: Briefcase, tone: 'amber', title: 'Careers', text: 'Internships, jobs, scholarships and hackathons with deadline reminders.' },
];

const TRUST = [
  { icon: BadgeCheck, tone: 'blue', title: 'Verified people', text: 'Faculty and alumni badges are granted only after moderators review the evidence.' },
  { icon: EyeOff, tone: 'violet', title: 'Private by default', text: 'Emails, phone numbers and housing contacts stay hidden unless you opt in.' },
  { icon: ShieldCheck, tone: 'emerald', title: 'Moderated & reportable', text: 'Report anything in two taps. Every moderation action is recorded in an audit log.' },
  { icon: Lock, tone: 'cyan', title: 'Secure sign-in', text: 'Hashed passwords, HttpOnly sessions, CSRF protection and lockout against password guessing.' },
];

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
  const startTo = isAuthenticated ? '/feed' : '/register';

  return (
    <div className="landing">
      <section className="hero">
        <div className="container hero-inner">
          <div className="rise">
            <span className="eyebrow">
              <span className="pill">New</span> The independent community for DIU · not an official DIU service
            </span>
            <h1>
              Your whole campus,
              <br />
              <span className="gradient-text">in one place.</span>
            </h1>
            <p className="lead">Share notes, ask questions, find a mess seat, discover research and land your next internship — built by and for the Dhaka International University community.</p>
            <PublicSearch />
            <div className="row-wrap" style={{ gap: 12 }}>
              <Link to={startTo} className="btn btn-primary btn-lg">
                {isAuthenticated ? 'Open your feed' : 'Create your free account'} <ArrowRight size={18} aria-hidden="true" />
              </Link>
              {!isAuthenticated && (
                <Link to="/login" className="btn btn-glass btn-lg">
                  Sign in
                </Link>
              )}
            </div>
            <div className="social-proof">
              <div className="avatar-stack" aria-hidden="true">
                {['Ayesha Rahman', 'Tanvir Hasan', 'Farhana Akter', 'Imran Hossain', 'Sadia Chowdhury'].map((n) => (
                  <Avatar key={n} name={n} size="sm" />
                ))}
              </div>
              <span>
                Join <strong>{data ? c.members ?? 0 : '…'}</strong> students, faculty & alumni
              </span>
            </div>
          </div>
          <HeroMock />
        </div>
      </section>

      <div className="container stats-band">
        <div className="card">
          {[
            ['members', 'Community members'],
            ['resources', 'Study resources'],
            ['research', 'Research projects'],
            ['communities', 'Communities'],
          ].map(([k, l]) => (
            <div key={k} className="stat">
              <strong>{data ? (c[k] ?? 0).toLocaleString() : '—'}</strong>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <section className="section container" id="features">
        <div className="section-head">
          <span className="eyebrow-label">
            <Sparkles size={14} aria-hidden="true" /> Everything campus life needs
          </span>
          <h2>Less searching. More doing.</h2>
          <p>Practical tools that save DIU students time every week — not just another social feed.</p>
        </div>
        <div className="bento">
          {BENTO.map((f) => (
            <div key={f.title} className={`card ${f.cls}`}>
              <IconTile icon={f.icon} tone={f.tone} size="lg" />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              {f.rows && (
                <div className="bento-visual" aria-hidden="true">
                  {f.rows.map(([a, b]) => (
                    <div key={a} className="bento-row">
                      <span className="grow truncate">{a}</span>
                      <b>{b}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <span className="eyebrow-label">How it works</span>
          <h2>Up and running in a minute</h2>
        </div>
        <div className="steps">
          {[
            ['Create your account', 'Sign up with your email and pick your department, program and batch.'],
            ['Join your communities', 'Your department, batch, courses and clubs — your feed fills up instantly.'],
            ['Share and discover', 'Post notes, ask questions, find housing, follow research and save opportunities.'],
          ].map(([t, d], i) => (
            <div key={t} className="step">
              <div className="step-num">{i + 1}</div>
              <h3>{t}</h3>
              <p className="mb-0">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section container" id="research">
        <div className="section-title">
          <div>
            <span className="eyebrow-label">Research hub</span>
            <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', marginTop: 6 }}>Featured research</h2>
          </div>
          <Link to="/research" className="btn btn-ghost">
            Explore all <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-3">
          {!data
            ? [1, 2, 3].map((i) => <Skeleton key={i} h={170} r={18} />)
            : data.research.map((r) => (
                <Link key={r._id} to={`/research/${r._id}`} className="card card-link stack" style={{ gap: 10 }}>
                  <div className="row-wrap">
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
          <div>
            <span className="eyebrow-label">On campus</span>
            <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', marginTop: 6 }}>Upcoming events</h2>
          </div>
          <Link to="/events" className="btn btn-ghost">
            All events <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-2">
          {(data?.events || []).map((e) => (
            <Link key={e._id} to={`/events/${e._id}`} className="card card-link row" style={{ alignItems: 'flex-start', gap: 16 }}>
              <div className="date-tile">
                <b>{new Date(e.startsAt).getDate()}</b>
                <span>{formatDate(e.startsAt, { month: 'short' })}</span>
              </div>
              <div className="grow">
                <div className="row-wrap" style={{ marginBottom: 6 }}>
                  {e.official ? <Badge tone="violet">Official</Badge> : <Badge>Community</Badge>}
                  <SampleBadge show={e.isDemo} />
                </div>
                <div className="card-title">{e.title}</div>
                <div className="meta">
                  <span>
                    <CalendarDays size={14} aria-hidden="true" /> {formatTime(e.startsAt)}
                  </span>
                  <span>{e.venue || 'Online'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="trust">
          <div>
            <span className="eyebrow-label">
              <ShieldCheck size={14} aria-hidden="true" /> Trust & safety
            </span>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.4vw,2.4rem)', margin: '8px 0 12px', letterSpacing: '-0.035em' }}>Built to be safe from day one</h2>
            <p className="muted" style={{ fontSize: '1.05rem' }}>
              A student platform holds personal information, housing contacts and private messages. We designed privacy and moderation in from the start, and we label what is verified and what is community-submitted.
            </p>
            {data?.announcements?.length > 0 && (
              <div className="card card-tight" style={{ marginTop: 20 }}>
                <div className="eyebrow-label" style={{ marginBottom: 6 }}>
                  Latest official announcement
                </div>
                <p className="small mb-0 clamp-3">{plainText(data.announcements[0].content)}</p>
              </div>
            )}
          </div>
          <div className="trust-list">
            {TRUST.map((t) => (
              <div key={t.title} className="trust-item">
                <IconTile icon={t.icon} tone={t.tone} />
                <div>
                  <h4>{t.title}</h4>
                  <p>{t.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {data?.stories?.length > 0 && (
        <section className="section container">
          <div className="section-head">
            <span className="eyebrow-label">Alumni</span>
            <h2>Stories from graduates</h2>
            <p>The paths that worked for people who sat in the same classrooms.</p>
          </div>
          <div className="grid grid-3">
            {data.stories.map((s) => (
              <figure key={s._id} className="card story-card" style={{ margin: 0 }}>
                <div className="row between">
                  <div className="quote-mark" aria-hidden="true">
                    “
                  </div>
                  <SampleBadge show={s.isDemo} />
                </div>
                <blockquote>
                  <div className="bold" style={{ marginBottom: 6, fontFamily: 'var(--font-display)' }}>
                    {s.successStory.title}
                  </div>
                  <span className="muted">{s.successStory.excerpt}…</span>
                </blockquote>
                <figcaption className="row">
                  <Avatar user={s.user} />
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
            <h2>Your campus is waiting.</h2>
            <p className="mb-0" style={{ maxWidth: 520 }}>
              Free for DIU students, faculty and alumni. Takes a minute to join — your contact details stay private.
            </p>
          </div>
          <Link to={startTo} className="btn btn-lg" style={{ background: '#fff', color: 'var(--navy-900)', border: 0 }}>
            {isAuthenticated ? 'Go to the hub' : 'Get started — it’s free'} <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
