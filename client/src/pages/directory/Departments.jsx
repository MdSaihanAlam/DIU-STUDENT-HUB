import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FlaskConical, GraduationCap, Users } from 'lucide-react';
import { useApi, useDebounce, useDocumentTitle, usePaginated } from '../../hooks/index.js';
import { Avatar, Badge, EmptyState, ErrorState, GridSkeleton, LoadMore, PageHeader, SampleBadge, SearchInput, Tabs } from '../../components/ui.jsx';
import { DepartmentFilter } from '../../components/common.jsx';

export function FacultyCard({ f }) {
  return (
    <Link to={`/faculty/${f._id}`} className="card card-link stack" style={{ gap: 10 }}>
      <div className="row">
        <Avatar src={f.photoUrl} name={f.name} size="lg" />
        <div className="grow">
          <div className="card-title">{f.name}</div>
          <div className="small muted">
            {f.designation || 'Faculty member'}
            {f.department?.code && ` · ${f.department.code}`}
          </div>
        </div>
      </div>
      <div className="row-wrap">
        {f.verified ? <Badge tone="primary">Verified profile</Badge> : <Badge>Unverified</Badge>}
        <SampleBadge show={f.isDemo} />
      </div>
      {f.researchInterests?.length > 0 && <div className="xs muted clamp-2">{f.researchInterests.join(' · ')}</div>}
    </Link>
  );
}

function FacultyTab() {
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const [department, setDepartment] = useState('');
  const list = usePaginated('/faculty', { q: dq, department }, { limit: 18 });
  return (
    <>
      <div className="filters">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name or research interest" label="Search faculty" />
        <DepartmentFilter value={department} onChange={setDepartment} />
      </div>
      {list.loading ? (
        <GridSkeleton />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No faculty found" />
      ) : (
        <div className="grid grid-3">
          {list.items.map((f) => (
            <FacultyCard key={f._id} f={f} />
          ))}
        </div>
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} total={list.total} shown={list.items.length} />
    </>
  );
}

export default function Departments() {
  useDocumentTitle('Departments & faculty');
  const [tab, setTab] = useState('departments');
  const { data, error, loading, reload } = useApi('/departments');
  return (
    <>
      <PageHeader title="Departments & faculty" subtitle="Explore departments, programs, research areas and faculty members." />
      <Tabs
        tabs={[
          { value: 'departments', label: 'Departments', icon: Building2 },
          { value: 'faculty', label: 'Faculty directory', icon: GraduationCap },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'faculty' ? (
        <FacultyTab />
      ) : loading ? (
        <GridSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="grid grid-2">
          {data.items.map((d) => (
            <Link key={d._id} to={`/departments/${d.slug}`} className="card card-link stack" style={{ gap: 10 }}>
              <div className="row">
                <span className="avatar avatar-lg" style={{ borderRadius: 14, fontSize: '0.95rem' }} aria-hidden="true">
                  {d.code}
                </span>
                <div className="grow">
                  <div className="card-title">{d.name}</div>
                  <div className="small muted">{d.faculty}</div>
                </div>
              </div>
              <div className="meta">
                <span>
                  <GraduationCap size={14} aria-hidden="true" /> {d.counts.faculty} faculty
                </span>
                <span>
                  <Users size={14} aria-hidden="true" /> {d.counts.members} members
                </span>
                <span>
                  <FlaskConical size={14} aria-hidden="true" /> {d.counts.research} projects
                </span>
              </div>
              <div className="row-wrap">
                {d.researchAreas.slice(0, 3).map((a) => (
                  <Badge key={a}>{a}</Badge>
                ))}
                <SampleBadge show={d.isDemo} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
