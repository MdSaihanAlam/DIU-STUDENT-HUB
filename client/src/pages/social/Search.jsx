import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BedDouble, BookOpen, Briefcase, CalendarDays, FileText, FlaskConical, GraduationCap, MessagesSquare, Search as SearchIcon, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { useDebounce, useDocumentTitle } from '../../hooks/index.js';
import { Badge, Button, CardSkeleton, EmptyState, ErrorState, SearchInput, Tabs } from '../../components/ui.jsx';
import { plainText, UserLine } from '../../components/common.jsx';
import { formatBDT, formatDate, humanize, timeAgo } from '../../utils/format.js';

const TYPES = [
  { value: 'all', label: 'All' },
  { value: 'posts', label: 'Posts', icon: MessagesSquare },
  { value: 'people', label: 'People', icon: Users },
  { value: 'resources', label: 'Notes', icon: BookOpen },
  { value: 'research', label: 'Research', icon: FlaskConical },
  { value: 'alumni', label: 'Alumni', icon: GraduationCap },
  { value: 'events', label: 'Events', icon: CalendarDays },
  { value: 'housing', label: 'Housing', icon: BedDouble },
  { value: 'careers', label: 'Careers', icon: Briefcase },
  { value: 'communities', label: 'Communities', icon: Users },
];

function Result({ type, item }) {
  const row = (to, icon, title, meta, extra) => (
    <Link to={to} className="list-item" style={{ color: 'inherit' }}>
      <span className="avatar avatar-sm" style={{ borderRadius: 10, background: 'var(--primary-softer)', color: 'var(--primary)' }} aria-hidden="true">
        {icon}
      </span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="small bold clamp-2">{title}</div>
        <div className="xs muted truncate">{meta}</div>
      </div>
      {extra}
    </Link>
  );
  switch (type) {
    case 'posts':
      return row(`/posts/${item._id}`, <MessagesSquare size={16} />, plainText(item.content).slice(0, 140), `${item.author?.name || ''} · ${timeAgo(item.createdAt)}`);
    case 'people':
      return (
        <div className="list-item">
          <UserLine user={item} meta={item.headline || item.department?.name} />
        </div>
      );
    case 'resources':
      return row(`/resources/${item._id}`, <FileText size={16} />, item.title, `${item.courseCode || ''} · ${humanize(item.resourceType)} · ${item.downloads} downloads`);
    case 'research':
      return row(`/research/${item._id}`, <FlaskConical size={16} />, item.title, `${item.domain} · ${humanize(item.status)}`);
    case 'alumni':
      return row(`/u/${item.user?._id}`, <GraduationCap size={16} />, item.user?.name, `${item.jobTitle || ''} ${item.employer ? `at ${item.employer}` : ''} · Class of ${item.graduationYear || '—'}`);
    case 'events':
      return row(`/events/${item._id}`, <CalendarDays size={16} />, item.title, `${formatDate(item.startsAt)} · ${item.venue || 'Online'}`, item.official ? <Badge tone="violet">Official</Badge> : null);
    case 'housing':
      return row(`/housing/${item._id}`, <BedDouble size={16} />, item.title, `${formatBDT(item.rent)} · ${item.area}`);
    case 'careers':
      return row(`/careers/${item._id}`, <Briefcase size={16} />, item.title, `${item.organization} · ${item.deadline ? `Deadline ${formatDate(item.deadline)}` : 'Rolling'}`, item.verified ? <Badge tone="success">Verified</Badge> : null);
    case 'communities':
      return row(`/communities/${item.slug}`, <Users size={16} />, item.name, `${item.memberCount} members · ${humanize(item.type)}`);
    default:
      return null;
  }
}

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') || '';
  const type = sp.get('type') || 'all';
  const [input, setInput] = useState(q);
  const dq = useDebounce(input, 400);
  useDocumentTitle(q ? `Search: ${q}` : 'Search');
  const [state, setState] = useState({ loading: false, data: null, error: null, page: 1 });

  useEffect(() => {
    if (dq !== q) setSp((p) => ({ ...Object.fromEntries(p), q: dq }), { replace: true });
  }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (q.trim().length < 2) return setState({ loading: false, data: null, error: null, page: 1 });
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get('/search', { q, type }, { signal: ctrl.signal })
      .then((data) => setState({ loading: false, data, error: null, page: 1 }))
      .catch((error) => error.name !== 'AbortError' && setState({ loading: false, data: null, error, page: 1 }));
    return () => ctrl.abort();
  }, [q, type]);

  const more = async () => {
    const next = state.page + 1;
    const d = await api.get('/search', { q, type, page: next });
    setState((s) => ({ ...s, page: next, data: { ...s.data, results: { ...d.results, items: [...s.data.results.items, ...d.results.items] } } }));
  };

  const groups = state.data?.groups;
  const total = groups ? Object.values(groups).reduce((n, g) => n + g.total, 0) : state.data?.results?.total;

  return (
    <div className="main-narrow" style={{ maxWidth: 820 }}>
      <h1>Search</h1>
      <div style={{ marginBottom: 12 }}>
        <SearchInput value={input} onChange={setInput} placeholder="Search posts, people, notes, research, events…" autoFocus />
      </div>
      <Tabs tabs={TYPES} value={type} onChange={(v) => setSp({ q, type: v }, { replace: true })} label="Search categories" />
      {q.trim().length < 2 ? (
        <div className="card">
          <EmptyState icon={SearchIcon} title="Search the whole hub">
            Try a course code like “CSE 213”, a skill like “React”, or an area like “Badda”.
          </EmptyState>
        </div>
      ) : state.loading ? (
        <CardSkeleton count={2} lines={2} />
      ) : state.error ? (
        <ErrorState error={state.error} />
      ) : !total ? (
        <div className="card">
          <EmptyState icon={SearchIcon} title={`No results for “${q}”`}>
            Check the spelling or try a broader term.
          </EmptyState>
        </div>
      ) : groups ? (
        <div className="stack">
          {TYPES.filter((t) => t.value !== 'all' && groups[t.value]?.items.length).map((t) => (
            <section key={t.value} className="card">
              <div className="section-title">
                <h2 className="row">
                  <t.icon size={18} aria-hidden="true" /> {t.label}
                </h2>
                {groups[t.value].total > groups[t.value].items.length && (
                  <Button variant="ghost" size="sm" onClick={() => setSp({ q, type: t.value })}>
                    See all {groups[t.value].total}
                  </Button>
                )}
              </div>
              <div className="list">
                {groups[t.value].items.map((item) => (
                  <Result key={item._id} type={t.value} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="card">
          <p className="small muted">{state.data.results.total} results</p>
          <div className="list">
            {state.data.results.items.map((item) => (
              <Result key={item._id} type={type} item={item} />
            ))}
          </div>
          {state.data.results.hasMore && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Button variant="soft" onClick={more}>
                Load more
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
