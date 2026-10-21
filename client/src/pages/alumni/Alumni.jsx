import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, GraduationCap, HeartHandshake, MapPin, Pencil, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi, useDebounce, useDocumentTitle, usePaginated, useQueryFilters } from '../../hooks/index.js';
import { Avatar, Badge, EmptyState, ErrorState, GridSkeleton, LoadMore, PageHeader, SampleBadge, SearchInput, Tabs, VerifiedBadge } from '../../components/ui.jsx';
import { DepartmentFilter } from '../../components/common.jsx';

function AlumniCard({ a }) {
  return (
    <Link to={`/u/${a.user?._id}`} className="card card-link stack" style={{ gap: 10 }}>
      <div className="row">
        <Avatar user={a.user} size="lg" />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}>
            <span className="card-title truncate" style={{ margin: 0 }}>
              {a.user?.name}
            </span>
            <VerifiedBadge user={a.user} compact />
          </div>
          <div className="small muted truncate">{[a.jobTitle, a.employer].filter(Boolean).join(' at ') || 'Alumni'}</div>
          <div className="xs subtle">
            {a.department?.code} · Class of {a.graduationYear || '—'}
          </div>
        </div>
      </div>
      <div className="row-wrap">
        {a.mentorshipAvailable && (
          <Badge tone="success" icon={HeartHandshake}>
            Open to mentoring
          </Badge>
        )}
        {a.industry && <Badge>{a.industry}</Badge>}
        <SampleBadge show={a.isDemo} />
      </div>
      {a.location && (
        <div className="meta">
          <span>
            <MapPin size={13} aria-hidden="true" /> {a.location}
          </span>
        </div>
      )}
    </Link>
  );
}

function Stories() {
  const { data, loading, error, reload } = useApi('/alumni/stories', { limit: 12 });
  if (loading) return <GridSkeleton count={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data.items.length) return <EmptyState icon={Sparkles} title="No stories yet">Alumni can share their journey from their alumni profile.</EmptyState>;
  return (
    <div className="grid grid-2">
      {data.items.map((s) => (
        <article key={s._id} className="card stack">
          <div className="row-wrap">
            {s.successStory?.featured && (
              <Badge tone="violet" icon={Sparkles}>
                Featured
              </Badge>
            )}
            <SampleBadge show={s.isDemo} />
          </div>
          <h3 className="mb-0">{s.successStory?.title || 'My journey'}</h3>
          <p className="pre-wrap muted small mb-0">{s.successStory?.body}</p>
          <Link to={`/u/${s.user?._id}`} className="row" style={{ color: 'inherit' }}>
            <Avatar user={s.user} size="sm" />
            <div>
              <div className="small bold">{s.user?.name}</div>
              <div className="xs muted">
                {s.jobTitle} · {s.employer} · {s.department?.code} {s.graduationYear}
              </div>
            </div>
          </Link>
        </article>
      ))}
    </div>
  );
}

export default function Alumni() {
  useDocumentTitle('Alumni network');
  const { user } = useAuth();
  const [filters, setFilter] = useQueryFilters({ q: '', department: '', year: '', industry: '', employer: '', role: '', mentorship: '', tab: 'directory' });
  const [q, setQ] = useState(filters.q);
  const dq = useDebounce(q, 350);
  useEffect(() => setFilter('q', dq), [dq, setFilter]);
  const [employer, setEmployer] = useState(filters.employer);
  const de = useDebounce(employer, 350);
  useEffect(() => setFilter('employer', de), [de, setFilter]);
  const facets = useApi('/alumni/facets');
  const { tab, ...params } = filters;
  const list = usePaginated('/alumni', params, { limit: 12 });

  return (
    <>
      <PageHeader
        title="Alumni & professional network"
        subtitle="Learn from DIU graduates, explore career paths and request mentorship."
        actions={
          user?.affiliation === 'alumni' && (
            <Link to="/alumni/edit" className="btn btn-primary">
              <Pencil size={16} aria-hidden="true" /> My alumni profile
            </Link>
          )
        }
      />
      <Tabs
        tabs={[
          { value: 'directory', label: 'Directory', icon: GraduationCap },
          { value: 'stories', label: 'Success stories', icon: Sparkles },
        ]}
        value={tab}
        onChange={(v) => setFilter('tab', v)}
      />
      {tab === 'stories' ? (
        <Stories />
      ) : (
        <>
          <div className="filters">
            <SearchInput value={q} onChange={setQ} placeholder="Search role, company, skill" label="Search alumni" />
            <DepartmentFilter value={filters.department} onChange={(v) => setFilter('department', v)} />
            <select className="select" value={filters.year} onChange={(e) => setFilter('year', e.target.value)} aria-label="Graduation year">
              <option value="">Any year</option>
              {(facets.data?.years || []).map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <select className="select" value={filters.industry} onChange={(e) => setFilter('industry', e.target.value)} aria-label="Industry">
              <option value="">Any industry</option>
              {(facets.data?.industries || []).map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
            <div className="input-icon" style={{ flex: '0 1 180px' }}>
              <Briefcase size={16} aria-hidden="true" />
              <input className="input" value={employer} onChange={(e) => setEmployer(e.target.value)} placeholder="Employer" aria-label="Employer" />
            </div>
            <label className="check" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={filters.mentorship === '1'} onChange={(e) => setFilter('mentorship', e.target.checked ? '1' : '')} />
              Open to mentoring
            </label>
          </div>
          {list.loading ? (
            <GridSkeleton />
          ) : list.error ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : list.items.length === 0 ? (
            <div className="card">
              <EmptyState icon={GraduationCap} title="No alumni match these filters" />
            </div>
          ) : (
            <div className="grid grid-3">
              {list.items.map((a) => (
                <AlumniCard key={a._id} a={a} />
              ))}
            </div>
          )}
          <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
        </>
      )}
    </>
  );
}
