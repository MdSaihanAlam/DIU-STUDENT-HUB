import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, Plus, Sparkles, Users } from 'lucide-react';
import { useApi, useDebounce, useDocumentTitle, usePaginated, useQueryFilters } from '../../hooks/index.js';
import { Badge, EmptyState, ErrorState, GridSkeleton, LoadMore, PageHeader, SampleBadge, SearchInput, Tabs } from '../../components/ui.jsx';
import { DepartmentFilter, SaveButton } from '../../components/common.jsx';
import { RESEARCH_STATUS } from '../../utils/constants.js';
import { humanize } from '../../utils/format.js';

export function ResearchCard({ p }) {
  return (
    <Link to={`/research/${p._id}`} className="card card-link stack" style={{ gap: 10 }}>
      <div className="row between">
        <div className="row-wrap">
          {p.featured && (
            <Badge tone="violet" icon={Sparkles}>
              Featured
            </Badge>
          )}
          {p.reviewStatus === 'verified' ? <Badge tone="success">Verified</Badge> : p.reviewStatus === 'pending' ? <Badge tone="warning">Unverified submission</Badge> : <Badge tone="danger">Rejected</Badge>}
          <SampleBadge show={p.isDemo} />
        </div>
        <SaveButton type="research" id={p._id} saved={p.saved} />
      </div>
      <div className="card-title clamp-2">{p.title}</div>
      <p className="small muted clamp-3 mb-0">{p.abstract}</p>
      <div className="row-wrap">
        <Badge tone="accent">{p.domain}</Badge>
        <Badge>{humanize(p.status)}</Badge>
        {p.collaborationOpen && (
          <Badge tone="primary" icon={Users}>
            Open to collaborators
          </Badge>
        )}
      </div>
      <div className="xs subtle">
        Led by {p.lead?.name}
        {p.department?.code && ` · ${p.department.code}`} · {p.followerCount} following
      </div>
    </Link>
  );
}

export default function Research() {
  useDocumentTitle('Research hub');
  const [filters, setFilter] = useQueryFilters({ q: '', department: '', domain: '', status: '', collab: '', tab: 'verified' });
  const [q, setQ] = useState(filters.q);
  const dq = useDebounce(q, 350);
  useEffect(() => setFilter('q', dq), [dq, setFilter]);
  const domains = useApi('/research/domains');
  const params = {
    q: filters.q,
    department: filters.department,
    domain: filters.domain,
    status: filters.status,
    collab: filters.collab,
    verified: filters.tab === 'all' ? '0' : '',
    mine: filters.tab === 'mine' ? '1' : '',
    featured: filters.tab === 'featured' ? '1' : '',
  };
  const list = usePaginated('/research', params, { limit: 12 });

  return (
    <>
      <PageHeader icon={FlaskConical} tone="violet"
        title="Research & innovation hub"
        subtitle="Ongoing and completed research by DIU students and faculty. Find projects, follow progress and collaborate."
        actions={
          <Link to="/research/new" className="btn btn-primary">
            <Plus size={17} aria-hidden="true" /> Submit a project
          </Link>
        }
      />
      <Tabs
        tabs={[
          { value: 'verified', label: 'Verified projects' },
          { value: 'featured', label: 'Featured' },
          { value: 'all', label: 'Include community submissions' },
          { value: 'mine', label: 'My projects' },
        ]}
        value={filters.tab}
        onChange={(v) => setFilter('tab', v)}
      />
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search title, abstract, technology or contributor" label="Search research" />
        <DepartmentFilter value={filters.department} onChange={(v) => setFilter('department', v)} />
        <select className="select" value={filters.domain} onChange={(e) => setFilter('domain', e.target.value)} aria-label="Research domain">
          <option value="">All domains</option>
          {(domains.data?.items || []).map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select className="select" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          {RESEARCH_STATUS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label className="check" style={{ alignItems: 'center' }}>
          <input type="checkbox" checked={filters.collab === '1'} onChange={(e) => setFilter('collab', e.target.checked ? '1' : '')} />
          Open to collaborators
        </label>
      </div>
      {list.loading ? (
        <GridSkeleton />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={FlaskConical} title="No projects found" action={<Link className="btn btn-primary" to="/research/new">Submit your project</Link>}>
            Try clearing filters or include community submissions.
          </EmptyState>
        </div>
      ) : (
        <div className="grid grid-2">
          {list.items.map((p) => (
            <ResearchCard key={p._id} p={p} />
          ))}
        </div>
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
    </>
  );
}
